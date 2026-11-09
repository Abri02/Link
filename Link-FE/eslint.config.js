import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Colours live in src/theme/. Keeps hardcoded values from coming back.
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          'Literal[value=/#[0-9a-fA-F]{6}\\b/]',
          'Literal[value=/rgba?\\(/]',
          'TemplateElement[value.raw=/#[0-9a-fA-F]{6}\\b/]',
          'TemplateElement[value.raw=/rgba?\\(/]',
        ].map((selector) => ({
          selector,
          message: 'Hardcoded colour: use a semantic token from src/theme/.',
        })),
      ],
    },
  },
])
