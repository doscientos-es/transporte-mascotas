# Arquitectura del frontend

## Estructura obligatoria

El frontend se organiza por feature y cada feature expone una API pública pequeña.

```text
src/
  app/                         # bootstrap, guards y routing global
  pages/                       # composición de una ruta a partir de APIs de features
  features/<feature>/
    application/               # casos de uso y orquestación
    infrastructure/            # adaptadores de datos e integraciones
    ui/                        # componentes, formularios y vistas
    types|mocks|tests/         # opcionales
    index.ts                   # API pública de la feature
  shared/                      # código transversal sin dependencia de features
```

Cada feature debe tener las tres capas y un `index.ts`. `app/router` resuelve la ruta, los guards y
las integraciones con React Router; una
página selecciona la UI pública de la feature correspondiente. Una feature no puede importar los
internals de otra ni depender de `app` o de `pages`.

## Dirección de dependencias

- `ui` usa `application`, `shared` y APIs públicas de otras features; nunca `infrastructure`.
- `application` no depende de `ui` ni de `app`; puede orquestar su infraestructura.
- `infrastructure` no depende de `ui` ni de `app`.
- `shared` no depende de `app` ni de ninguna feature.
- `pages` puede componer APIs públicas de features y `shared`, pero no sus internals.
- Los hooks de React Router y el mapa URL → sección viven en `app/router`; `pages` recibe el
  contexto de ruta ya resuelto.
- El código de producción no importa `mocks` ni `tests`.

`@/shared/infrastructure/supabase.ts` es el único adaptador que importa Supabase en runtime. Los
tipos de Supabase sí pueden importarse donde sean necesarios.

## Design system

Los primitives genéricos se importan exclusivamente desde `@doscientos/ui`. `shared/ui` puede
contener composición y branding de este producto, pero no copias de botones, inputs, diálogos o
componentes de datos. El módulo UI es responsable de su accesibilidad, stories y pruebas.

## Validación automática

`pnpm run architecture:check` verifica los directorios raíz, las capas y el API público de cada
feature, además de bloquear mocks y tests en producción. Oxlint aplica las mismas restricciones a
nivel de imports durante el desarrollo. `pnpm check` ejecuta formato, arquitectura, lint
semántico TypeScript, typecheck y tests.
