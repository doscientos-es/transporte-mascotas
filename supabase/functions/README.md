# Bizum comercios de CaixaBank (Cyberpac)

Las funciones implementan el flujo **solicitud de pago → Bizum → factura emitida**. El cliente recibe un enlace opaco, completa Bizum en Cyberpac y sólo la notificación firmada emite y numera la factura.

## Antes de desplegar

1. Contratad con CaixaBank la pasarela online **Cyberpac/TPV Virtual con Bizum para comercios** y solicitad acceso de pruebas y producción.
2. Configurad los secretos de CaixaBank: `CAIXABANK_CYBERPAC_MERCHANT_CODE`, `CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_SECRET`, `CAIXABANK_CYBERPAC_ENDPOINT` y `PUBLIC_APP_URL`.
3. En Cyberpac configurad la notificación HTTP a `https://<project-ref>.supabase.co/functions/v1/caixabank-webhook` y activad Bizum para el terminal.
4. Desplegad `invoice-payment`, `payment-redirect`, `caixabank-webhook`, `send-billing-notifications` e `issued-invoice`, aplicad las migraciones y realizad primero una operación en pruebas.

`CAIXABANK_CYBERPAC_ENDPOINT` debe ser la URL que entregue CaixaBank para cada entorno; no se debe adivinar ni guardar ninguna clave en el frontend.

## Facturación y comunicaciones

Antes de abrir cobros configurad los datos fiscales no secretos que aparecerán congelados en cada factura: `INVOICE_ISSUER_NAME`, `INVOICE_ISSUER_TAX_ID` e `INVOICE_ISSUER_ADDRESS`. No se emite una factura si falta alguno.

Para email configurad `RESEND_API_KEY` y `RESEND_FROM` (un remitente de dominio verificado en Resend).

Para WhatsApp Cloud API configurad `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_PAYMENT_TEMPLATE` y `META_WHATSAPP_INVOICE_TEMPLATE`. Las dos plantillas aprobadas en Meta deben ser de utilidad, idioma `es`, y tener exactamente dos variables de cuerpo: texto descriptivo y enlace. Se puede sobrescribir la versión de Graph con `META_WHATSAPP_GRAPH_API_VERSION`.

Los enlaces de pago y de factura expiran en 30 días. La factura conserva una instantánea inmutable de emisor, cliente, importes, pago y número fiscal; el enlace sólo permite consultarla, no modificarla. Cada envío queda registrado y los reintentos se reclaman de forma atómica para evitar duplicados.
