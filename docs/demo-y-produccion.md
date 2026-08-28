# Puesta en marcha con Supabase

La aplicación requiere Supabase: no contiene datos de demostración ni conserva cambios locales que se pierdan al recargar.

1. Aplica las migraciones de `supabase/migrations/` en orden, incluida `20260828180200_submit_transport_request_atomically.sql`.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con las credenciales publicables del proyecto.
3. Usa `/admin` para el acceso profesional y `/cliente/acceso` para el área de cliente.
   - El rol `admin` debe asignarse desde el backoffice o Supabase; nunca desde los metadatos de alta pública.
4. Valida RLS con un administrador, un transportista y un cliente antes de importar datos reales.
   - Al crear una ruta, asígnala al transportista correspondiente; una ruta sin asignar no será visible para ningún transportista.
