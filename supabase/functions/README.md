# Bizum comercios de CaixaBank (Cyberpac)

Las funciones implementan una integración por redirección: la aplicación crea un enlace opaco, el cliente completa Bizum en Cyberpac y sólo la notificación firmada marca la factura como pagada.

## Antes de desplegar

1. Contratad con CaixaBank la pasarela online **Cyberpac/TPV Virtual con Bizum para comercios** y solicitad acceso de pruebas y producción.
2. Configurad en Supabase los secretos `CAIXABANK_CYBERPAC_MERCHANT_CODE`, `CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_SECRET`, `CAIXABANK_CYBERPAC_ENDPOINT` y `PUBLIC_APP_URL`.
3. En Cyberpac configurad la notificación HTTP a `https://<project-ref>.supabase.co/functions/v1/caixabank-webhook` y activad Bizum para el terminal.
4. Desplegad `invoice-payment`, `payment-redirect` y `caixabank-webhook`, aplicad la migración y realizad primero una operación en pruebas.

`CAIXABANK_CYBERPAC_ENDPOINT` debe ser la URL que entregue CaixaBank para cada entorno; no se debe adivinar ni guardar ninguna clave en el frontend.