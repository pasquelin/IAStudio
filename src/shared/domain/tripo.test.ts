import { describe, expect, it } from 'vitest'
import { CAPABILITIES_BY_FAMILY } from './model'
import {
  isTripoModelId,
  tripoEntryOf,
  tripoFieldKeys,
  tripoFieldsOf,
  tripoModelId,
  TRIPO_CATALOGUE,
  TRIPO_LANE_LIMITS,
} from './tripo'

const entryOf = (endpoint: string) => {
  const entry = TRIPO_CATALOGUE.find(one => one.endpoint === endpoint)
  if (!entry) throw new Error(`no ${endpoint} in the catalogue`)
  return entry
}

describe('the Tripo catalogue', () => {
  it('names every entry once', () => {
    const ids = TRIPO_CATALOGUE.map(tripoModelId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('finds an entry back from the id a job target carries', () => {
    const entry = entryOf('generation/text-to-model')
    expect(tripoEntryOf(tripoModelId(entry))).toBe(entry)
  })

  it('answers nothing for an id this build does not publish', () => {
    expect(tripoEntryOf('tripo:generation/nothing:tripo-v9')).toBeNull()
    expect(tripoEntryOf('model_scenario_flux')).toBeNull()
  })

  it('tells its own ids from every other runtime', () => {
    expect(isTripoModelId(tripoModelId(entryOf('generation/text-to-model')))).toBe(true)
    expect(isTripoModelId('model_scenario_flux')).toBe(false)
  })

  /**
   * 🛑 MEASURED against the live service on 2026-08-31, by a body it refused: posting
   * `tripo-v3.1` — the spelling their model page and the plan both use — answers
   * « invalid model 'tripo-v3.1', allowed values: … ». There are FIVE lines, not four, and the
   * P2 is named by the service alone.
   */
  it('serves the five lines the service names, spelled as it spells them', () => {
    const lines = new Set(
      TRIPO_CATALOGUE.filter(entry => entry.capability === 'txt23d').map(entry => entry.model),
    )

    expect([...lines]).toEqual([
      'v3.1-20260211',
      'v3.0-20250812',
      'v2.5-20250123',
      'P1-20260311',
      'P2-20260801',
    ])
  })

  /**
   * The plan promised one unified `input` on every endpoint. Measured, four name it otherwise,
   * and sending `input` to those is refused with code 1004.
   */
  it('names each endpoint its own input field, as the service asks for it', () => {
    const keyOf = (endpoint: string): string | undefined =>
      TRIPO_CATALOGUE.find(one => one.endpoint === endpoint)?.fields.find(one => one.required)?.key

    expect(keyOf('generation/image-to-model')).toBe('file')
    expect(keyOf('generation/multiview-to-model')).toBe('files')
    expect(keyOf('models/refine')).toBe('draft_model_task_id')
    expect(keyOf('models/stylize')).toBe('original_model_task_id')
    expect(keyOf('models/texture')).toBe('input')
  })

  /** Rigging takes a `model` of its own, on a list of its own — measured. */
  it('asks rigging for its own line rather than a mesh one', () => {
    const rig = TRIPO_CATALOGUE.find(one => one.endpoint === 'animations/rig')

    expect(rig?.model).toBe('v2.5-20260210')
  })

  /** The four picture lists differ: a cartesian product offers runs the service refuses. */
  it('offers each picture endpoint only the models it admits', () => {
    const modelsOn = (endpoint: string): string[] =>
      TRIPO_CATALOGUE.filter(one => one.endpoint === endpoint).flatMap(one => one.model ?? [])

    expect(modelsOn('generation/text-to-image')).toContain('seedream_v4')
    expect(modelsOn('generation/image-to-image')).not.toContain('seedream_v4')
    expect(modelsOn('generation/edit-multiview')).toEqual(['seedream_v4', 'default'])
    // The plan's own list: none of these three is a name the service knows.
    expect(modelsOn('generation/text-to-image')).not.toContain('gemini-3-pro')
  })

  it('offers an employment the studio actually has a picker for', () => {
    for (const entry of TRIPO_CATALOGUE) {
      expect(CAPABILITIES_BY_FAMILY[entry.family], entry.endpoint).toContain(entry.capability)
    }
  })

  it('counts every entry in a lane with a published ceiling', () => {
    for (const entry of TRIPO_CATALOGUE) {
      expect(TRIPO_LANE_LIMITS[entry.lane], entry.endpoint).toBeGreaterThan(0)
    }
  })

  // The one ceiling that forces a lane per category rather than one number for the whole cloud.
  it('holds pictures to one at a time', () => {
    expect(TRIPO_LANE_LIMITS.image).toBe(1)
  })
})

describe('tripoFieldsOf', () => {
  it('names the field, its help and every value of a closed list', () => {
    const fields = tripoFieldsOf(entryOf('generation/text-to-model'), key => `said(${key})`)
    const texture = fields.find(field => field.key === 'texture')
    const quality = fields.find(field => field.key === 'texture_quality')

    expect(texture?.label).toBe('said(tripoFields.texture)')
    expect(texture?.help).toBe('said(tripoFields.textureHelp)')
    expect(quality?.options).toEqual([
      { value: 'standard', label: 'said(tripoFields.qualityStandard)' },
      { value: 'detailed', label: 'said(tripoFields.qualityDetailed)' },
    ])
  })

  it('marks what turning a knob adds to the bill', () => {
    const fields = tripoFieldsOf(entryOf('generation/text-to-model'), key => key)
    expect(fields.find(field => field.key === 'pbr')?.costImpact).toBe(true)
    expect(fields.find(field => field.key === 'export_uv')?.costImpact).toBeUndefined()
  })

  it('leaves no key of the catalogue out of what a bundle has to name', () => {
    const keys = new Set(tripoFieldKeys())
    expect(keys.has('tripoFields.qualityDetailed')).toBe(true)
    expect(keys.has('localFields.prompt')).toBe(true)
  })
})
