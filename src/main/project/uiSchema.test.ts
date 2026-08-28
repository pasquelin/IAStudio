import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { UI_TEMPLATE_IDS, uiFromTemplate } from '@shared/domain/uiTemplates'
import { UI_SCHEMA_FILE, uiDocumentSchema, uiJsonSchema } from './uiSchema'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

let counter = 0
const newId = (): string => `made-${(counter += 1)}`

const published = (): unknown => JSON.parse(readFileSync(join(ROOT, UI_SCHEMA_FILE), 'utf8'))

describe('the published interface schema', () => {
  /**
   * 🛑 That the file on disk IS what the format says today. The whole reason it is generated
   * rather than written: a schema edited without rerunning `pnpm ui:schema` is red here, not a
   * quiet promise made to whoever pointed an editor at it.
   */
  it('is what the format says today', () => {
    expect(published()).toEqual(uiJsonSchema())
  })

  /**
   * The half a recomputation cannot see: that what the studio WRITES passes what it publishes.
   * A schema disagreeing with the files is worse than none — an editor would refuse a document
   * that opens perfectly well.
   */
  it.each(UI_TEMPLATE_IDS)('accepts the document a new %s interface opens on', id => {
    expect(uiDocumentSchema.safeParse(uiFromTemplate(id, newId)).success).toBe(true)
  })

  it('turns away a document that is not one', () => {
    const whole = uiFromTemplate('hud', newId)

    expect(uiDocumentSchema.safeParse({ ...whole, root: { type: 'panel' } }).success).toBe(false)
    // Bounded high: a file written by a later build is refused rather than read as this one.
    expect(uiDocumentSchema.safeParse({ ...whole, version: 2 }).success).toBe(false)
    expect(uiDocumentSchema.safeParse({ ...whole, mode: 'holographic' }).success).toBe(false)
  })
})
