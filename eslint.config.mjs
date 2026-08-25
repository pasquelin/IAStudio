import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // `public/decoders/` is three.js's own Draco and KTX2 glue, copied in by
  // `scripts/copy-decoders.mjs`. Vendored code, and minified: linting it says nothing.
  globalIgnores(['out', 'dist', 'node_modules', 'docs', 'src/renderer/public']),
  js.configs.recommended,
  // `recommended`, not `recommendedTypeChecked`: no rule here reads a type, so the parser is
  // given no program to build. `parserOptions.projectService` used to sit below and cost one —
  // the very program `pnpm typecheck` builds a moment earlier. Removing it halved the lint, and
  // all eight rules fire identically without it, `consistent-type-imports` included: it works by
  // scope analysis, which is what typescript-eslint documents. Add a typed rule and the service
  // comes back with it — `src/main/gate-caches.test.ts` holds the pair together.
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
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
    /**
     * The eleven build scripts, which `pnpm lint` did not reach while they hold what the build
     * and the legal notices run on. They are Node programs: reading `process` and writing to the
     * console is their job, not a slip, so `no-undef` needs to be told — and `no-console` above
     * is scoped to `.ts`/`.tsx`, which leaves them free to print, as a command-line tool must.
     *
     * The three are spelled out rather than pulled from a `globals` package: adding a dependency
     * to name three identifiers costs more than the list, and the list says what these scripts
     * actually touch.
     */
    files: ['scripts/**/*.{mjs,ts}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        // `cdp.mjs` parle au protocole DevTools : Node 22+ porte WebSocket, et les minuteurs
        // bornent une attente de réponse.
        WebSocket: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    // Lifted for the one `.ts` among them, which the block above catches by extension: the rule
    // exists because the renderer's journal belongs to the main process, and a build script has
    // no journal to belong to — printing IS its output.
    rules: { 'no-console': 'off' },
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
      // Red in the editor, not only in CI: a dependency array that lies costs a stale value at
      // the moment the user acts, which is the hardest kind of bug to reproduce afterwards.
      'react-hooks/exhaustive-deps': 'error',
      // Decided rather than inherited: `lint` runs at zero warnings, so every rule this config
      // leaves at `warn` blocks a merge without anyone having chosen it. Unlike its neighbour
      // above, this one is answerable — the syntax it names can be rewritten.
      'react-hooks/unsupported-syntax': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
])
