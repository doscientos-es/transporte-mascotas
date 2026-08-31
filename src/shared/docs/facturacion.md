# Facturación de transporte de mascotas

## Flujo operativo

1. Administración crea una **solicitud de pago** desde la carta de porte e incluye los datos fiscales del destinatario.
2. Se envía un enlace de pago, o administración registra un cobro manual con el método real.
3. Solo al confirmarse el cobro se emite la factura: se asigna un número correlativo por serie y año y se congela el emisor, destinatario, importes, operación y cobro.
4. Un proceso servidor genera y guarda el PDF canónico exclusivamente desde esa instantánea emitida. La factura emitida se puede buscar, filtrar, previsualizar y descargar; la solicitud de pago se puede previsualizar y descargar solo como documento informativo, nunca como factura.

## Controles aplicados

- Base imponible, IVA y total se almacenan con dos decimales y se valida que `total = base + IVA`.
- Una factura emitida no se puede modificar ni eliminar desde la base de datos; debe regularizarse mediante rectificativa o anulación.
- La creación de la solicitud y la emisión quedan anotadas en `invoice_events` y `audit_logs`.
- La interfaz administrativa recupera el PDF privado almacenado; no construye una segunda factura en el navegador.
- La solicitud de pago se genera en el navegador como un PDF informativo, identificado expresamente como documento no fiscal.
- Cada PDF se vincula explícitamente a `issued_invoices.id`; los documentos previos sin ese vínculo se regeneran de forma segura al siguiente acceso.
- Mientras siga pendiente de cobro, la misma carta permite corregir su solicitud fiscal; al emitirse, cualquier intento de modificación queda bloqueado.
- El enlace público caduca por seguridad; administración conserva acceso a la factura emitida y puede reenviarla.

## Antes de producción

1. Aplicar las migraciones `20260828110000_invoice_integrity_and_access.sql` y `20260828120000_canonical_invoice_documents.sql` en un entorno de prueba.
2. Desplegar `invoice-pdf`, `issued-invoice`, `confirm-manual-invoice-payment` y el webhook de Cyberpac junto con el nuevo módulo compartido `invoice-document`.
3. Configurar los datos fiscales del emisor y probar: pago Cyberpac correcto, pago rechazado, cobro manual, reenvío y segundo intento del mismo cobro.
4. Confirmar con la asesoría el momento de devengo del servicio y de los anticipos. El flujo actual presupone que el cobro confirmado es el hito de emisión; si se factura después de prestar el servicio sin anticipo, debe añadirse una emisión independiente antes del límite legal aplicable.

## Preparación para Veri*Factu

La factura ya conserva los datos que necesita el mapper del módulo `@doscientos/verifactu`: emisor, destinatario, número, fecha de emisión, fecha de operación, desglose de IVA y total inmutables. La integración efectiva requiere todavía un proceso servidor que cree un ledger append-only con hash encadenado, outbox de remisión, QR y los flujos de rechazo/rectificación/anulación, usando el módulo compartido.

No se debe activar ni anunciar la remisión a AEAT como operativa hasta completar esa integración, usar el certificado correspondiente y ejecutar la batería de pruebas de preproducción. Referencias: RD 1007/2023, Orden HAC/1177/2024 y guías vigentes de la AEAT.
