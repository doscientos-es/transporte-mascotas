# Kache Envios

Aplicación web para la gestión de transporte de mascotas, rutas, solicitudes, cobros y
facturación.

## Requisitos

- Node.js 24 o compatible con la configuración del proyecto.
- pnpm 11.25.0.
- Un proyecto de Supabase para ejecutar la aplicación conectada a datos reales.

## Desarrollo local

1. Instala las dependencias:

   ```text
   pnpm install
   ```

2. Copia `.env.example` a `.env.local` y completa las variables públicas de Supabase:
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

3. Arranca el servidor de desarrollo:

   ```text
   pnpm dev
   ```

Las claves privadas de pagos, facturación y WhatsApp no deben configurarse en Vite ni en el
navegador. Se consumen exclusivamente desde Supabase Edge Functions. La configuración de esas
funciones está documentada en [`supabase/functions/README.md`](./supabase/functions/README.md).

## Comandos de calidad

- `pnpm format`: aplica el formato.
- `pnpm format:check`: comprueba el formato sin escribir.
- `pnpm architecture:check`: valida las capas y las APIs públicas de las features.
- `pnpm lint`: ejecuta Oxlint.
- `pnpm lint:strict`: ejecuta Oxlint tratando los warnings como errores.
- `pnpm typecheck`: verifica TypeScript.
- `pnpm test`: ejecuta las pruebas unitarias.
- `pnpm test:coverage`: genera el informe de cobertura.
- `pnpm build`: ejecuta typecheck y genera el bundle de producción.
- `pnpm check`: ejecuta el conjunto de comprobaciones previo a un PR.

El workflow de GitHub Actions ejecuta `pnpm check` y `pnpm build` en cada pull request y en cada
push a `main`.

## Arquitectura

El frontend está organizado por features y capas. La guía está en
[`src/shared/docs/frontend-architecture.md`](./src/shared/docs/frontend-architecture.md).

- `src/app`: bootstrap, guards y routing global.
- `src/pages`: composición de rutas.
- `src/features`: funcionalidades de negocio aisladas.
- `src/shared`: código transversal sin dependencias de features.
- `supabase/migrations`: cambios versionados de base de datos.
- `supabase/functions`: integraciones y operaciones de servidor.

## Release checklist

Antes de publicar una versión:

1. Confirma que el CI está verde.
2. Revisa las migraciones pendientes y aplícalas en el entorno correcto.
3. Comprueba las variables públicas de Vite y los secretos de Edge Functions por separado.
4. Ejecuta una prueba de pago en el entorno de pruebas antes de activar producción.
5. Verifica que los backups recientes pueden restaurarse.
6. Revisa manualmente el flujo de login, solicitud, pago y consulta de factura.

Los cambios de base de datos deben hacerse mediante una nueva migración; no se deben editar
migraciones ya aplicadas en un entorno compartido.

## Documentación adicional

- [Arquitectura frontend](./src/shared/docs/frontend-architecture.md)
- [Pruebas de CaixaBank Cyberpac](./docs/caixabank-cyberpac-test.md)
- [Configuración de Edge Functions y pagos](./supabase/functions/README.md)
