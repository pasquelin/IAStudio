/**
 * Writes `docs/schema/ui-<version>.schema.json`, the JSON Schema a `.ui.json` points at.
 *
 * Derived from the Zod schema of `src/main/project/uiSchema.ts` rather than written by hand: a
 * published schema disagreeing with what the studio accepts is worse than none, since an editor
 * would then refuse a file that opens perfectly well.
 *
 * `--import ./scripts/tsResolve.mjs` is what lets this reach the project's TypeScript at all;
 * `pnpm ui:schema` carries it, and `main/project/uiSchema.test.ts` recomputes the file so a
 * forgotten run is a red gate rather than a quiet drift.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { UI_SCHEMA_FILE, uiJsonSchema } from '@main/project/uiSchema'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const target = join(ROOT, UI_SCHEMA_FILE)
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, `${JSON.stringify(uiJsonSchema(), null, 2)}\n`)

console.log(`wrote ${UI_SCHEMA_FILE}`)
