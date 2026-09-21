# Automatización de WhatsApp para Kache Envíos

## Alcance

Kache Envíos usa dos números separados. El número principal del transportista
permanece en su app de WhatsApp Business para la conversación humana, sin
migrarlo ni tocarlo. El número dedicado y la integración con Cloud API se
conservan únicamente para pruebas explícitas de administración. Los clientes no
reciben comunicaciones automáticas sobre su transporte ni su pago; si escriben
al número de avisos, la autorespuesta puede redirigirlos al teléfono principal.

Los avisos transaccionales están desactivados: crear una carta, confirmar una
reserva, solicitar un pago, emitir una factura o cerrar una ruta no genera ni
envía WhatsApp. Las reservas creadas desde el portal tampoco generan avisos al
confirmarse. El área de pruebas de administración sigue disponible para validar
la integración de Meta de forma explícita.

## Eventos automáticos

| Evento transaccional                                      | Resultado                         |
| --------------------------------------------------------- | --------------------------------- |
| Reserva del portal, carta, pago, factura o cierre de ruta | No se genera ni se envía WhatsApp |

Los teléfonos pueden conservarse como datos de contacto operativo, pero no son
requisitos de entrega de WhatsApp ni activan ningún envío.

## Configuración de Meta

Si se habilitan pruebas controladas, crear una app de Meta Business con el
producto **WhatsApp**, asociar y verificar el número de Kache Envíos, y crear las
plantillas de utilidad en español. Los secretos solo se configuran en Supabase
Edge Functions; nunca en el frontend.

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

Las funciones de envío transaccional no forman parte del flujo operativo actual:
no se deben configurar cron ni secretos para despacharlas. La aplicación no
intenta despachar avisos y las migraciones cancelan cualquier cola histórica
pendiente.

Las pruebas explícitas desde **Ajustes → Pruebas de WhatsApp** son la única
operación que puede contactar con Meta.

## Puesta en marcha y prueba

1. Aplicar todas las migraciones y desplegar las funciones de Edge.
2. Si se desea probar Meta, configurar sus secretos y plantillas sólo en Edge
   Functions.
3. Usar **Ajustes → Pruebas de WhatsApp** únicamente si se desea validar Meta con
   un teléfono controlado.
4. En el entorno de pruebas de CaixaBank, validar pago correcto, rechazado,
   reintento del webhook y generación administrativa de factura sin WhatsApp.

No registrar tokens, secretos, teléfonos completos ni enlaces de pago en logs.
El historial de las tablas de notificaciones contiene únicamente el estado, el
identificador de Meta, los intentos y un error limitado para soporte.
