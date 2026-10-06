# Pagos con tarjeta de CaixaBank (Cyberpac/Redsys)

Las funciones implementan el flujo **solicitud de pago → tarjeta en Cyberpac → factura emitida**. El cliente recibe un enlace opaco, completa el pago en la pasarela alojada y sólo la notificación firmada emite y numera la factura.

## Antes de desplegar

1. Contratad con CaixaBank la pasarela online **Cyberpac/TPV Virtual para comercios** y solicitad acceso de pruebas y producción.
2. Configurad los secretos de CaixaBank: `CAIXABANK_CYBERPAC_MERCHANT_CODE`, `CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_SECRET`, `CAIXABANK_CYBERPAC_ENDPOINT` y `PUBLIC_APP_URL`.
3. En Cyberpac configurad la notificación HTTP a `https://<project-ref>.supabase.co/functions/v1/caixabank-webhook` para el terminal. La integración usa redirección alojada y tarjetas; no se envían datos de tarjeta a la aplicación.
4. Desplegad `invoice-payment`, `transport-payment`, `payment-redirect`, `caixabank-webhook`, `issued-invoice`, `confirm-manual-invoice-payment`, `send-payment-request-email` (email con el enlace de pago al crear una carta manual) y `client-payment-request` (botón Pagar en la cuenta del cliente), aplicad las migraciones y realizad primero una operación en pruebas. Las funciones de notificación transaccional no son necesarias.

`CAIXABANK_CYBERPAC_ENDPOINT` debe ser la URL que entregue CaixaBank para cada entorno; en test suele ser `https://sis-t.redsys.es:25443/sis/realizarPago`. No se debe adivinar ni guardar ninguna clave en el frontend. Para restringir métodos opcionalmente se puede usar `CAIXABANK_CYBERPAC_PAYMETHODS`; si se deja vacío, Cyberpac muestra los métodos habilitados para el terminal.

## Facturación y comunicaciones

Antes de abrir cobros configurad los datos fiscales no secretos que aparecerán congelados en cada factura: `INVOICE_ISSUER_NAME`, `INVOICE_ISSUER_TAX_ID` e `INVOICE_ISSUER_ADDRESS`. No se emite una factura si falta alguno.

Todas las comunicaciones con clientes se envían por email.

### Confirmaciones de pago por email (Resend)

La confirmación de pago se envía por email con Resend. Se envía cuando Cyberpac confirma el pago de una solicitud de transporte
(a `contact_email`) o de una solicitud de pago, y cuando administración registra
un cobro manual (al email de los datos fiscales). Si no hay email válido no se
envía nada. Un fallo de envío sólo se registra en los logs: nunca bloquea el pago
ni la emisión de la factura. Cada envío usa la factura emitida como clave de
idempotencia para evitar duplicados.

El email incluye el resumen del servicio (trayecto, fecha, mascotas, importe y
número de factura), un botón al portal (`PUBLIC_APP_URL/mis-transportes`) y otro
para añadir el transporte a Google Calendar. Adjunta:

- **Factura en PDF**: la misma copia inmutable que se guarda en `invoices`.
- **Carta de porte en PDF**: generada en el servidor con el mismo formato que la
  descarga del portal.
- **Invitación `.ics`** de día completo para la fecha del transporte, con aviso
  la tarde anterior. Se envía como `METHOD:REQUEST` con el remitente como
  organizador, de modo que Gmail, Outlook y Apple Mail la muestran como
  invitación y pueden añadirla automáticamente según la configuración del
  cliente.

Si un adjunto no se puede preparar, se registra en los logs y el email se envía
con el resto.

| Secreto             | Uso                                                                  |
| ------------------- | -------------------------------------------------------------------- |
| `RESEND_API_KEY`    | API key de Resend con permiso de envío                               |
| `RESEND_FROM_EMAIL` | Remitente de un dominio verificado, p. ej. `Kache Envíos <avisos@…>` |
| `RESEND_REPLY_TO`   | Opcional. Dirección a la que llegan las respuestas del cliente       |

Tras configurar los secretos, redesplegad `caixabank-webhook` y
`confirm-manual-invoice-payment`.

### Cierre de itinerario diario

Cerrar una ruta el día anterior fija las paradas y los tiempos y encola un email
de recordatorio (Resend) para cada remitente y destinatario con email válido de
las cartas de la ruta. Tras cerrar, el panel invoca
`send-daily-route-closure-notifications`; si un envío falla queda en `fallida` y
se reintenta al volver a invocar la función. Desplegad esa función y la
migración `20261001120000_route_closure_email_notifications.sql`.

### Emails de autenticación (recuperar contraseña)

Supabase Auth envía por el SMTP de Resend (`smtp.resend.com`, usuario `resend`,
contraseña = `RESEND_API_KEY`) con las plantillas de `supabase/templates`
(`recovery.html`, `confirmation.html`). Para aplicarlo en el proyecto alojado
ejecutad `supabase config push` con `RESEND_API_KEY` definido en el entorno.

La página **Ajustes → Prueba de email** usa la Edge Function `send-test-email` y el cliente
compartido de Resend para enviar un mensaje real a la dirección asociada a la cuenta
administradora. Desplegad esa función con `verify_jwt = true`; las credenciales de Resend
se mantienen únicamente en el servidor.

Las solicitudes de transporte usan `transport-payment`: el importe se calcula en la base
de datos según el tamaño de cada box y se guarda en la solicitud antes de generar el
enlace de Cyberpac. Las tarifas iniciales son 80 €, 100 € y 140 € para pequeño,
mediano y grande; sólo un administrador puede cambiarlas desde **Ajustes → Tarifa por
tamaño de box**.

Los enlaces de pago y de factura expiran en 30 días. La factura conserva una instantánea inmutable de emisor, cliente, importes, pago, fecha de operación y número fiscal; el enlace sólo permite consultarla, no modificarla.

## Cobros manuales y documentos fiscales

Una solicitud de pago no es una factura y no se puede descargar como tal. Para un cobro que se gestione fuera de Cyberpac, un administrador debe usar **Registrar cobro** e indicar el método empleado. Esa operación emite y numera la factura en una única transacción.

Los datos fiscales del destinatario (nombre/razón social, NIF/CIF y dirección) son obligatorios antes de crear el cobro. Las facturas emitidas quedan inmutables: cualquier corrección posterior debe gestionarse mediante una rectificativa o anulación, no editando el documento original.
