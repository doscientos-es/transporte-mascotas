# Demo inmediata y paso a producción

## Demo de hoy

La app funciona sin Supabase usando los datos locales de ejemplo de `src/lib/data.ts`.

1. No definas `VITE_SUPABASE_URL` ni `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Ejecuta `pnpm dev`.
3. Abre la URL que muestra Vite.

La demo incluye cartas, rutas, clientes y facturas de ejemplo. Puedes buscar y filtrar cartas, cambiar de página, crear rutas locales, reordenar o personalizar sus paradas, editar clientes y generar PDFs. Los cambios locales se pierden al recargar.

## Estado de la demo

- Cartas: datos de ejemplo, paginación local de 8 registros.
- Rutas: datos de ejemplo, selector paginado de 12 rutas.
- Clientes: datos de ejemplo, directorio paginado de 12 clientes.
- PDF: se genera en el navegador y no depende de Supabase.
- Soporte: abre un correo a `hola@doscientos.es`.

## Activar Supabase después de la demo

1. Revisa y aplica las migraciones presentes en `supabase/migrations/`.
   - `20260806113000_add_manual_invoice_payer.sql` permite facturar a una empresa u otro titular manual.
   - `20260806143000_transporter_route_access.sql` asigna las rutas a transportistas y limita sus datos a su ruta y facturas relacionadas.
2. Configura las variables de entorno de Supabase con credenciales publicables del proyecto.
3. Crea usuarios y sus perfiles con el rol adecuado para las políticas RLS.
4. Implementa las consultas paginadas en servidor pendientes:
   - cartas: `range`, `count`, orden por `imported_at`, búsqueda y estado;
   - rutas: paginación de metadatos y carga bajo demanda del detalle de la ruta seleccionada;
   - clientes: página de directorio e historial solo del cliente seleccionado.
5. Valida RLS con un administrador y un transportista antes de importar datos reales.
   - Al crear una ruta, asígnala al transportista correspondiente; una ruta sin asignar no será visible para ningún transportista.

## Por qué no activar Supabase durante la demo

La UI de cartas todavía consume los conjuntos demo. Al activar Supabase, las rutas diarias, sus servicios y las facturas se consultan con las restricciones de rol correspondientes. Mantener el modo demo evita mostrar una pantalla vacía o una autenticación incompleta durante la presentación.
