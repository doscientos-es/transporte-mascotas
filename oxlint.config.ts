import { createFeatureLayersConfig } from '@doscientos/configs/architecture'
import { reactViteConfig } from '@doscientos/configs/oxlint/react-vite'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [
    reactViteConfig,
    createFeatureLayersConfig({
      bannedPatterns: [
        {
          group: ['@/shared/ui/primitives/**'],
          message: 'Importa primitives reutilizables desde @doscientos/ui.',
        },
      ],
      restrictedPaths: [
        {
          name: '@base-ui/react',
          message: 'Importa primitives reutilizables desde @doscientos/ui.',
        },
        {
          name: '@supabase/supabase-js',
          allowTypeImports: true,
          message:
            'Accede a Supabase mediante un adaptador de infrastructure; los tipos están permitidos.',
        },
      ],
    }),
  ],
  ignorePatterns: ['dist/**', 'node_modules/**', 'supabase/**'],
  settings: {
    react: {
      version: '19.2.8',
    },
  },
  overrides: [
    {
      files: ['src/shared/ui/primitives/**'],
      rules: {
        'react/only-export-components': 'off',
      },
    },
    {
      files: ['src/shared/infrastructure/supabase.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
})
