# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Calidad

La aplicación usa Oxlint para errores de calidad y arquitectura, y Oxfmt para un formato rápido y
determinista.

- `pnpm format`: aplica el formato.
- `pnpm format:check`: comprueba el formato sin escribir.
- `pnpm lint`: ejecuta las reglas que bloquean cambios inseguros.
- `pnpm lint:strict`: también falla por advertencias; úsalo tras eliminar el backlog de avisos.
- `pnpm typecheck`: verifica TypeScript.
- `pnpm check`: ejecuta formato, lint y tipos de forma secuencial.

La guía de capas y la migración incremental a features está en
[`docs/frontend-architecture.md`](./docs/frontend-architecture.md).
