import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // `public/decoders/` is three.js's own Draco and KTX2 glue, copied in by
  // `scripts/copy-decoders.mjs`. Vendored code, and minified: linting it says nothing.
  globalIgnores(['out', 'dist', 'node_modules', 'docs', 'src/renderer/public']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // The convention forbids `as const`: explicit union, named type, or inference.
      // No built-in rule covers it, hence the AST selector.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSTypeReference > Identifier[name="const"]',
          message: 'No `as const`: declare an explicit union or a named type.',
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    // `configs.recommended` is still in legacy format (plugins as an array); only
    // `configs.flat.*` works in a flat config.
    extends: [reactHooks.configs.flat['recommended-latest']],
    rules: {
      // Reports that the React Compiler gives up memoizing a component using a third-party
      // library (react-virtual, react-i18next). That is an observation, not a defect: the
      // only way to clear it would be to drop those libraries.
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
])
