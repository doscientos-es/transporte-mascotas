# Pagos con tarjeta de CaixaBank (Cyberpac/Redsys)

Las funciones implementan el flujo **solicitud de pago → tarjeta en Cyberpac → factura emitida**. El cliente recibe un enlace opaco, completa el pago en la pasarela alojada y sólo la notificación firmada emite y numera la factura.

## Antes de desplegar

1. Contratad con CaixaBank la pasarela online **Cyberpac/TPV Virtual para comercios** y solicitad acceso de pruebas y producción.
2. Configurad los secretos de CaixaBank: `CAIXABANK_CYBERPAC_MERCHANT_CODE`, `CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_SECRET`, `CAIXABANK_CYBERPAC_ENDPOINT` y `PUBLIC_APP_URL`.
3. En Cyberpac configurad la notificación HTTP a `https://<project-ref>.supabase.co/functions/v1/caixabank-webhook` para el terminal. La integración usa redirección alojada y tarjetas; no se envían datos de tarjeta a la aplicación.
4. Desplegad `invoice-payment`, `transport-payment`, `payment-redirect`, `caixabank-webhook`, `issued-invoice` y `confirm-manual-invoice-payment`, aplicad las migraciones y realizad primero una operación en pruebas. Las funciones de notificación transaccional no son necesarias.

`CAIXABANK_CYBERPAC_ENDPOINT` debe ser la URL que entregue CaixaBank para cada entorno; en test suele ser `https://sis-t.redsys.es:25443/sis/realizarPago`. No se debe adivinar ni guardar ninguna clave en el frontend. Para restringir métodos opcionalmente se puede usar `CAIXABANK_CYBERPAC_PAYMETHODS`; si se deja vacío, Cyberpac muestra los métodos habilitados para el terminal.

## Facturación y comunicaciones

Antes de abrir cobros configurad los datos fiscales no secretos que aparecerán congelados en cada factura: `INVOICE_ISSUER_NAME`, `INVOICE_ISSUER_TAX_ID` e `INVOICE_ISSUER_ADDRESS`. No se emite una factura si falta alguno.

Los avisos transaccionales están desactivados y la facturación no depende de
WhatsApp. Si se necesita probar la integración manualmente, configurad
`META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` y las plantillas
únicamente en Edge Functions.

### Número de avisos y número principal (modelo de dos números)

Kache usa dos números separados. El número principal del transportista queda en
su app de WhatsApp Business para conversación humana, sin tocarlo. El número
dedicado sólo se utiliza para pruebas explícitas de administración.

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

Una carta de porte manual queda programada al guardarse y una solicitud queda
programada al confirmarla, pero ninguna de las dos operaciones encola WhatsApp.
Las plantillas de Meta sólo se usan desde las pruebas explícitas de administración:

- `META_WHATSAPP_TRANSPORT_CONFIRMATION_TEMPLATE`: debe comunicar que el pago y la ruta están confirmados.
- `META_WHATSAPP_ROUTE_REMINDER_TEMPLATE`: debe recordar la salida prevista para el día siguiente.

### Cierre de itinerario diario

Cerrar una ruta el día anterior sólo fija las paradas y los tiempos. No deja una
notificación para clientes ni requiere configurar `send-daily-route-closure-notifications`.

La página **Ajustes → Pruebas de WhatsApp** es la única operación que puede
contactar con Meta. Las cartas, reservas, pagos, facturas y cierres de ruta no
se despachan automáticamente.

Las solicitudes de transporte usan `transport-payment`: el importe se calcula en la base
de datos según el tamaño de cada box y se guarda en la solicitud antes de generar el
enlace de Cyberpac. Las tarifas iniciales son 80 €, 100 € y 140 € para pequeño,
mediano y grande; sólo un administrador puede cambiarlas desde **Ajustes → Tarifa por
tamaño de box**.

Los enlaces de pago y de factura expiran en 30 días. La factura conserva una instantánea inmutable de emisor, cliente, importes, pago, fecha de operación y número fiscal; el enlace sólo permite consultarla, no modificarla. La emisión y la disponibilidad en el CRM no dependen de WhatsApp.

## Cobros manuales y documentos fiscales

Una solicitud de pago no es una factura y no se puede descargar como tal. Para un cobro que se gestione fuera de Cyberpac, un administrador debe usar **Registrar cobro** e indicar el método empleado. Esa operación emite y numera la factura en una única transacción.

Los datos fiscales del destinatario (nombre/razón social, NIF/CIF y dirección) son obligatorios antes de crear el cobro. Las facturas emitidas quedan inmutables: cualquier corrección posterior debe gestionarse mediante una rectificativa o anulación, no editando el documento original.
