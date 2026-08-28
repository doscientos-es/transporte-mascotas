# Arquitectura del frontend

## Principios

El frontend se organiza por **feature** y cada feature expone una API pública pequeña. La
dependencia siempre apunta hacia el dominio; las rutas sólo componen features y no contienen
reglas de negocio.

```text
src/features/<feature>/
  ui/           componentes, formularios y estados de presentación
  application/  casos de uso y hooks de orquestación
  domain/       entidades, invariantes, contratos y tipos de negocio
  data/         adaptadores HTTP/Supabase que implementan contratos del dominio
```

## Reglas de dependencia

- `ui` usa `application` y tipos de `domain`; no importa `data` directamente.
- `application` coordina `domain` y sus contratos; no conoce componentes ni rutas.
- `domain` no depende de React, Supabase ni de detalles de infraestructura.
- `data` adapta Supabase u otros servicios al contrato definido por la feature.
- Una feature consume otra sólo mediante su API pública, nunca mediante sus archivos internos.

Las rutas y la composición global vivirán en `src/pages` mientras se completa la migración. Los
primitives de `@/components/ui` también son compartidos y no contienen lógica de negocio.

## Migración incremental

La estructura actual (`pages`, `components`, `hooks` y `lib`) es el estado legado. Al modificar
un flujo, muévelo completo a una carpeta `features/<feature>` en lugar de hacer una migración
masiva. Conserva temporalmente adaptadores en `lib` y reexpórtalos desde la feature hasta que no
haya consumidores legados.

Oxlint protege desde ahora la dirección de las dependencias: componentes no pueden importar
rutas; `hooks` y `lib` no pueden importar la UI; y el cliente de Supabase queda encapsulado en
`src/lib/supabase.ts` (los tipos pueden importarse). La regla preparada para `features/*/ui`
impide además saltarse `application` para acceder directamente a `data`.
