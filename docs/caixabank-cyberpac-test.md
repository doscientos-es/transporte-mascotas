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
- Firma: `HMAC_SHA256_V1`
- Endpoint de test: `https://sis-t.redsys.es:25443/sis/realizarPago`

La clave secreta debe pegarse sólo en `CAIXABANK_CYBERPAC_SECRET` de los secretos
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

## Tarifas del transporte por box

Las tarifas iniciales son **80 € para pequeño**, **100 € para mediano** y **140 €
para grande**. Un administrador puede cambiarlas en `Ajustes → Tarifa por tamaño
de box`. El cliente sólo ve una estimación; al enviar la solicitud, la base de
datos recalcula el tamaño desde peso y medidas y guarda el importe en céntimos.
El pago de Redsys usa ese importe guardado, por lo que cambiar una tarifa no
modifica solicitudes ya creadas.

## Pase a producción

No se debe cambiar a producción sólo sustituyendo el endpoint. CaixaBank debe
proporcionar la clave, el endpoint y la configuración del terminal real. Antes
del pase hay que actualizar las URLs públicas, cargar los secretos en el
proyecto de producción y repetir una operación real de importe controlado.
