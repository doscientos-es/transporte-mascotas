import path from 'node:path'

import { createVitestConfig } from '@doscientos/configs/vitest'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              priority: 30,
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'react-aria',
              priority: 20,
              test: /node_modules[\\/](?:react-aria-components|@react-aria|@react-stately|@react-types)[\\/]/,
            },
            {
              name: 'supabase',
              priority: 20,
              test: /node_modules[\\/]@supabase[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    // Avoid stale modules in VS Code's embedded browser during development.
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: createVitestConfig({
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: [
        'src/app/router/dashboard-routes.ts',
        'src/features/dashboard/application/route-segment.ts',
      ],
    },
  }),
})
