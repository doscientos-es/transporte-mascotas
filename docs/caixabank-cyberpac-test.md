9# Pruebas de CaixaBank Cyberpac / Redsys

La aplicación usa la integración **Hosted / Redirección** para una aplicación de
desarrollo propio. Los datos de tarjeta se introducen únicamente en la página de
Redsys; nunca pasan por el frontend ni por Supabase.

## Configuración de test

En el entorno local están preparados los datos no secretos en `.env.local`:

- Comercio: `369901590`
- Terminal: `1`
- Moneda: `978` (EUR)
- Tipo de operación: `0` (autorización)
- Firma: `HMAC_SHA512_V2`
- Endpoint de test: `https://sis-t.redsys.es:25443/sis/realizarPago`

La clave secreta SHA-512 debe pegarse sólo en `CAIXABANK_CYBERPAC_SECRET` de los secretos
de Supabase Edge Functions y en el entorno local si se ejecuta la pasarela local.
No debe añadirse al frontend, al repositorio ni a un mensaje de soporte. También
hay que configurar `PUBLIC_APP_URL` con la URL HTTPS pública de la aplicación.

El módulo de administración de test está en
`https://sis-t.redsys.es:25443/canales/`. El usuario es el número de comercio;
la contraseña se conserva únicamente en el correo de CaixaBank y no forma parte
de la configuración de la aplicación.

## URLs que debe conocer CaixaBank

Notificación server-to-server:

`https://<project-ref>.supabase.co/functions/v1/caixabank-webhook`

La URL de éxito es `<PUBLIC_APP_URL>/?payment=ok` y la de error es
`<PUBLIC_APP_URL>/?payment=ko`. La notificación firmada es la fuente de verdad
para marcar una factura como pagada; no se emite una factura sólo por volver a
la URL de éxito.

## Tarjetas de prueba

| Caso               | Número             | Caducidad | CVV2         | CIP/3-D Secure |
| ------------------ | ------------------ | --------- | ------------ | -------------- |
| Operación aceptada | `4548810000000003` | `12/27`   | `123`        | `123456`       |
| Operación denegada | `1111111111111117` | `12/27`   | No requerido | No requerido   |

Estas tarjetas sólo deben usarse contra el endpoint de test. No son tarjetas
válidas para producción.

## Checklist rápido

1. Aplicar las migraciones y desplegar `invoice-payment`, `transport-payment`,
   `payment-redirect` y `caixabank-webhook`.
2. Configurar los secretos de Supabase: `CAIXABANK_CYBERPAC_MERCHANT_CODE`,
   `CAIXABANK_CYBERPAC_TERMINAL`, `CAIXABANK_CYBERPAC_CURRENCY`,
   `CAIXABANK_CYBERPAC_TRANSACTION_TYPE`, `CAIXABANK_CYBERPAC_SIGNATURE_VERSION`,
   `CAIXABANK_CYBERPAC_SECRET`, `CAIXABANK_CYBERPAC_ENDPOINT`, `PUBLIC_APP_URL`
   y los datos fiscales del emisor.
3. Crear una solicitud de pago de factura desde el panel y enviarla por WhatsApp.
4. Abrir el enlace, probar primero la tarjeta aceptada y verificar que la factura
   pasa a emitida sólo después de recibir la notificación.
5. Repetir con la tarjeta denegada y verificar que el pago queda fallido y la
   factura no se emite.
6. Revisar los logs de `caixabank-webhook` y que el endpoint responde `OK`.
