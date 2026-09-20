# Bizum comercios de CaixaBank (Cyberpac)

Las funciones implementan el flujo **solicitud de pago → Bizum → factura emitida**. El cliente recibe un enlace opaco, completa Bizum en Cyberpac y sólo la notificación firmada emite y numera la factura.

## Antes de desplegar

1. Contratad con CaixaBank la pasarela online **Cyberpac/TPV Virtual con Bizum para comercios** y solicitad acceso de pruebas y producción.
2. Configurad los secretos de CaixaBank: `CAIXABANK_CYBERPAC_MERCHANT_CODE`, `CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_SECRET`, `CAIXABANK_CYBERPAC_ENDPOINT` y `PUBLIC_APP_URL`.
3. En Cyberpac configurad la notificación HTTP a `https://<project-ref>.supabase.co/functions/v1/caixabank-webhook` y activad Bizum para el terminal.
4. Desplegad `invoice-payment`, `payment-redirect`, `caixabank-webhook`, `send-billing-notifications`, `send-transport-notifications`, `issued-invoice` y `confirm-manual-invoice-payment`, aplicad las migraciones y realizad primero una operación en pruebas.

`CAIXABANK_CYBERPAC_ENDPOINT` debe ser la URL que entregue CaixaBank para cada entorno; no se debe adivinar ni guardar ninguna clave en el frontend.

## Facturación y comunicaciones

Antes de abrir cobros configurad los datos fiscales no secretos que aparecerán congelados en cada factura: `INVOICE_ISSUER_NAME`, `INVOICE_ISSUER_TAX_ID` e `INVOICE_ISSUER_ADDRESS`. No se emite una factura si falta alguno.

Todos los avisos se entregan por WhatsApp. Para WhatsApp Cloud API configurad `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_PAYMENT_TEMPLATE` y `META_WHATSAPP_INVOICE_TEMPLATE`. Las dos plantillas aprobadas en Meta deben ser de utilidad, idioma `es`, y tener exactamente dos variables de cuerpo: texto descriptivo y enlace. Se puede sobrescribir la versión de Graph con `META_WHATSAPP_GRAPH_API_VERSION`.

### Número de avisos y número principal (modelo de dos números)

Kache usa dos números separados. El número principal del transportista queda en
su app de WhatsApp Business para conversación humana, sin tocarlo. Las
notificaciones automáticas salen de un número nuevo dedicado a avisos,
registrado en la Cloud API; su SIM debe conservarse encendida según las
condiciones del operador y conviene activar el PIN de dos factores de la cuenta.

Quien escriba al número de avisos recibe una autorespuesta que redirige al
teléfono principal. Para activarla desplegad `whatsapp-webhook` y configurad:

| Secreto                        | Uso                                                                  |
| ------------------------------ | -------------------------------------------------------------------- |
| `META_WHATSAPP_VERIFY_TOKEN`   | Cadena aleatoria que se entrega a Meta al dar de alta el webhook     |
| `META_WHATSAPP_APP_SECRET`     | App secret de Meta para validar la cabecera `X-Hub-Signature-256`    |
| `META_WHATSAPP_AUTOREPLY_TEXT` | Texto de la autorespuesta; sin valor, el webhook no contesta a nadie |

En Meta configurad el webhook con la URL
`https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, suscrito al
campo `messages`. El webhook ignora recibos de entrega y eventos `system`,
`reaction` y `unsupported`, y responde siempre 2xx al tráfico firmado para que
Meta no dé de baja la suscripción.

### Confirmaciones y recordatorios de transporte

Una carta de porte manual queda programada al guardarse; una solicitud queda programada al confirmarla. Se encola una confirmación inmediata y un recordatorio para las 10:00 (Europe/Madrid) del día anterior a la ruta para remitente y destinatario. Si ambos teléfonos coinciden, se evita el duplicado. Configurad dos plantillas de utilidad aprobadas en Meta, idioma `es`, con **seis** variables de cuerpo, en este orden: nombre, fecha de ruta, origen, destino, enlace de Google Maps para la recogida y enlace de Google Maps para la entrega:

- `META_WHATSAPP_TRANSPORT_CONFIRMATION_TEMPLATE`: debe comunicar que el pago y la ruta están confirmados.
- `META_WHATSAPP_ROUTE_REMINDER_TEMPLATE`: debe recordar la salida prevista para el día siguiente.

### Cierre de itinerario diario

Cerrar una ruta el día anterior deja una notificación durable por cada teléfono de cliente implicado. Cuando se configure la API, desplegad e invocad `send-daily-route-closure-notifications` para procesarla. Configurad `META_WHATSAPP_DAILY_ROUTE_CLOSURE_TEMPLATE` como plantilla de utilidad, idioma `es`, con tres variables de cuerpo: nombre del cliente, fecha de servicio e itinerario.

La página **Ajustes → Pruebas de WhatsApp** comprueba ambos mensajes sin crear datos de clientes. Para despachar cartas automáticamente, configurad `CARRIAGE_LETTER_NOTIFICATIONS_CRON_SECRET` y un cron cada cinco minutos que invoque `send-carriage-letter-notifications` con `POST`, el cuerpo `{ "action": "dispatch" }` y la cabecera `x-carriage-letter-notifications-cron-secret`. Configurad otro cron equivalente para `send-billing-notifications`, usando `BILLING_NOTIFICATIONS_CRON_SECRET` y `x-billing-notifications-cron-secret`. El procesador reclama cada aviso de forma atómica y permite reintentos seguros; sin esos secretos, los endpoints sólo aceptan sesiones de administrador.

Los enlaces de pago y de factura expiran en 30 días. La factura conserva una instantánea inmutable de emisor, cliente, importes, pago, fecha de operación y número fiscal; el enlace sólo permite consultarla, no modificarla. Cada envío queda registrado y los reintentos se reclaman de forma atómica para evitar duplicados.

## Cobros manuales y documentos fiscales

Una solicitud de pago no es una factura y no se puede descargar como tal. Para un cobro que se gestione fuera de Cyberpac, un administrador debe usar **Registrar cobro** e indicar el método empleado. Esa operación emite y numera la factura en una única transacción.

Los datos fiscales del destinatario (nombre/razón social, NIF/CIF y dirección) son obligatorios antes de crear el cobro. Las facturas emitidas quedan inmutables: cualquier corrección posterior debe gestionarse mediante una rectificativa o anulación, no editando el documento original.
