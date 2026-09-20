# Automatización de WhatsApp para Kache Envíos

## Alcance

Kache Envíos usa dos números separados. El número principal del transportista
permanece en su app de WhatsApp Business para la conversación humana, sin
migrarlo ni tocarlo. Los avisos transaccionales salen de un número nuevo
dedicado, registrado en la Cloud API, que paga Meta por mensaje sin cuotas a
terceros. Los clientes no aportan credenciales ni pagan Meta: reciben
comunicaciones sobre su transporte o su pago, y si escriben al número de avisos
una autorespuesta los redirige al teléfono principal.

Los avisos son una cola durable: crear una carta, una solicitud de pago o una
factura nunca depende de que Meta esté disponible en ese momento.

## Eventos automáticos

| Evento                                       | Destinatario             | Plantilla                  | Momento                              |
| -------------------------------------------- | ------------------------ | -------------------------- | ------------------------------------ |
| Carta de porte manual o solicitud confirmada | Remitente y destinatario | Confirmación de transporte | Al quedar programada                 |
| Ruta de una carta programada                 | Remitente y destinatario | Recordatorio de ruta       | 10:00 Europe/Madrid del día anterior |
| Carta manual con importe                     | Pagador fiscal           | Solicitud de pago          | Al crear la solicitud                |
| Cobro validado por CaixaBank                 | Pagador fiscal           | Factura emitida            | Tras el webhook bancario firmado     |

Si remitente y destinatario tienen el mismo número se envía un solo WhatsApp.
Los dos teléfonos son obligatorios y deben tener formato español de nueve cifras
o internacional. Un número bien formado que no tenga WhatsApp no bloquea el
negocio: Meta lo rechazará, Kache registrará el fallo final y no repetirá el
mensaje indefinidamente.

## Configuración de Meta

Crear una app de Meta Business con el producto **WhatsApp**, asociar y verificar
el número de Kache Envíos, y crear las siguientes plantillas de utilidad en
español. Los secretos solo se configuran en Supabase Edge Functions; nunca en el
frontend.

| Secreto                                         | Uso                                       |
| ----------------------------------------------- | ----------------------------------------- |
| `META_WHATSAPP_ACCESS_TOKEN`                    | Token de sistema con permiso de envío     |
| `META_WHATSAPP_PHONE_NUMBER_ID`                 | Identificador del número emisor           |
| `META_WHATSAPP_GRAPH_API_VERSION`               | Opcional; usar la versión vigente de Meta |
| `META_WHATSAPP_TRANSPORT_CONFIRMATION_TEMPLATE` | Confirmación de transporte                |
| `META_WHATSAPP_ROUTE_REMINDER_TEMPLATE`         | Recordatorio de ruta                      |
| `META_WHATSAPP_PAYMENT_TEMPLATE`                | Solicitud de pago                         |
| `META_WHATSAPP_INVOICE_TEMPLATE`                | Factura emitida                           |
| `META_WHATSAPP_DAILY_ROUTE_CLOSURE_TEMPLATE`    | Cierre de itinerario diario               |

Para el webhook del número de avisos (autorespuesta que redirige al teléfono
principal) hay que añadir `META_WHATSAPP_VERIFY_TOKEN`, `META_WHATSAPP_APP_SECRET`
y `META_WHATSAPP_AUTOREPLY_TEXT`, y desplegar `whatsapp-webhook` con el campo
`messages` suscrito en Meta.

Las plantillas de confirmación y recordatorio requieren seis variables de cuerpo,
en este orden: nombre del contacto, fecha, origen, destino, enlace Maps de
recogida y enlace Maps de entrega. Las plantillas de pago y factura requieren dos:
texto descriptivo y enlace seguro.

## Configuración de CaixaBank

Mientras Cyberpac/Bizum no esté contratado, las solicitudes de pago quedan
encoladas y no se entregan. Cuando CaixaBank facilite el entorno correspondiente,
configurar `CAIXABANK_CYBERPAC_MERCHANT_CODE`,
`CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_SECRET`,
`CAIXABANK_CYBERPAC_ENDPOINT`, `PUBLIC_APP_URL`,
`INVOICE_ISSUER_NAME`, `INVOICE_ISSUER_TAX_ID` e `INVOICE_ISSUER_ADDRESS`.

En Cyberpac se debe registrar como notificación HTTP:

`https://<project-ref>.supabase.co/functions/v1/caixabank-webhook`

La factura se emite únicamente tras validar la firma, el pedido, la divisa y el
importe de esa notificación. La URL de retorno del navegador no emite facturas.

## Trabajadores y recuperación

Desplegar `send-carriage-letter-notifications` y la versión actualizada de
`send-billing-notifications`. Crear secretos aleatorios distintos:

| Secreto                                     | Cabecera del cron                             |
| ------------------------------------------- | --------------------------------------------- |
| `CARRIAGE_LETTER_NOTIFICATIONS_CRON_SECRET` | `x-carriage-letter-notifications-cron-secret` |
| `BILLING_NOTIFICATIONS_CRON_SECRET`         | `x-billing-notifications-cron-secret`         |

Ejecutar ambos cada cinco minutos con `POST` y cuerpo `{"action":"dispatch"}`.
Los endpoints aceptan la cabecera del cron o una sesión de administrador. El alta
desde la aplicación intenta entregarlos al instante; el cron recupera cortes de
red, cierres de navegador y reintentos pendientes.

Cada trabajo se reclama de forma atómica. Los errores transitorios de Meta y de
red se reintentan hasta cinco veces con espera exponencial; los rechazos finales
de Meta quedan registrados para revisión. Las cartas canceladas detienen los
avisos que todavía no se hayan entregado.

## Puesta en marcha y prueba

1. Aplicar todas las migraciones y desplegar las funciones de Edge.
2. Configurar los secretos de Meta y las cuatro plantillas aprobadas.
3. Configurar los dos cron y comprobar que reciben un `2xx`.
4. Usar **Ajustes → Pruebas de WhatsApp** para verificar las plantillas de
   transporte con un teléfono controlado.
5. Crear una carta manual de prueba para verificar: dos confirmaciones (o una si
   el teléfono coincide), recordatorio pendiente y solicitud de pago en cola.
6. En el entorno de pruebas de CaixaBank, validar pago correcto, rechazado,
   reintento del webhook y reenvío manual de factura.

No registrar tokens, secretos, teléfonos completos ni enlaces de pago en logs.
El historial de las tablas de notificaciones contiene únicamente el estado, el
identificador de Meta, los intentos y un error limitado para soporte.
