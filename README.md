# Kache Envíos — Transporte de mascotas

Aplicación operativa con backoffice y reservas públicas en `/reservas`.

## Puesta en marcha

1. Crea `.env.local` a partir de `.env.example` con las credenciales publicables de Supabase.
2. Aplica las migraciones, incluida `20260824130000_operations_and_reservations.sql`.
3. Configura las rutas como publicadas, sus paradas activas y las reglas de precio.
4. Despliega `supabase/functions/deliver-documents` y define sus secretos en Supabase.

Las credenciales de Resend y Meta WhatsApp Cloud API son exclusivamente de servidor. La aplicación no procesa pagos: un administrador confirma manualmente el cobro en **Reservas**.

---

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
