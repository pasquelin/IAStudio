/**
 * Writes the JSON Schema a `.ui.json` points at, from the Zod of `main/project/uiSchema.ts`.
 *
 * Run it through `pnpm ui:schema`, which carries the `--import` that lets a script reach the
 * project's TypeScript; `main/project/uiSchema.test.ts` recomputes the file, so a forgotten run
 * is a red gate rather than a quiet drift.
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
