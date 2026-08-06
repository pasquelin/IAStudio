import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['out', 'dist', 'node_modules', 'docs']),
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
      // La convention interdit `as const` : union explicite, type nommé, ou inférence.
      // Aucune règle native ne le couvre, d'où le sélecteur AST.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSTypeReference > Identifier[name="const"]',
          message: 'Pas de `as const` : déclarer une union explicite ou un type nommé.',
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    // `configs.recommended` reste au format legacy (plugins en tableau) ; seul
    // `configs.flat.*` est utilisable en configuration à plat.
    extends: [reactHooks.configs.flat['recommended-latest']],
    rules: {
      // Signale que le React Compiler renonce à mémoïser un composant utilisant une
      // bibliothèque tierce (react-virtual, react-i18next). C'est un constat, pas un défaut :
      // la seule façon de le lever serait de renoncer à ces bibliothèques.
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
])
