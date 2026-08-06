# Demo inmediata y paso a producción

## Demo de hoy

La app funciona sin Supabase usando los datos locales de ejemplo de `src/lib/data.ts`.

1. No definas `VITE_SUPABASE_URL` ni `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Ejecuta `pnpm dev`.
3. Abre la URL que muestra Vite.

La demo incluye cartas, rutas, clientes y facturas de ejemplo. Puedes buscar y filtrar cartas, cambiar de página, crear rutas locales, editar clientes y generar PDFs. Los cambios locales se pierden al recargar.

## Estado de la demo

- Cartas: datos de ejemplo, paginación local de 8 registros.
- Rutas: datos de ejemplo, selector paginado de 12 rutas.
- Clientes: datos de ejemplo, directorio paginado de 12 clientes.
- PDF: se genera en el navegador y no depende de Supabase.
- Soporte: abre un correo a `hola@doscientos.es`.

## Activar Supabase después de la demo

1. Revisa y aplica la migración `supabase/migrations/20260806103000_scale_pagination.sql`.
2. Configura las variables de entorno de Supabase con credenciales publicables del proyecto.
3. Crea usuarios y sus perfiles con el rol adecuado para las políticas RLS.
4. Implementa las consultas paginadas en servidor pendientes:
   - cartas: `range`, `count`, orden por `imported_at`, búsqueda y estado;
   - rutas: página de metadatos y detalle de la ruta seleccionada bajo demanda;
   - clientes: página de directorio e historial solo del cliente seleccionado.
5. Valida RLS con un administrador y un transportista antes de importar datos reales.

## Por qué no activar Supabase durante la demo

La UI de cartas y rutas todavía consume los conjuntos demo. La migración deja tablas e índices preparados, pero no sustituye automáticamente esos datos por consultas remotas. Mantener el modo demo evita mostrar una pantalla vacía o una autenticación incompleta durante la presentación.