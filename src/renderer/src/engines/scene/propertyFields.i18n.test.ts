import { describe, expect, it } from 'vitest'
import { LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'
import { isRecord } from '@shared/guards'
import { DEFAULT_CAMERA, TEXTURE_SLOTS } from '@shared/domain/scene'
import { LIGHT_TYPES } from './lightTypes'
import { MESH_PRIMITIVES } from './meshPrimitives'
import {
  cameraFields,
  geometryFields,
  lightFields,
  materialFields,
  spriteFields,
  textFields,
} from './propertyFields'
import { DEFAULT_MATERIAL, DEFAULT_SPRITE, DEFAULT_TEXT } from './sceneState'

/**
 * Every parameter the inspector can draw, from the registries rather than from a list kept by
 * hand: a primitive gains a field by gaining a property, and nothing else has to be edited.
 */
function everyFieldName(): readonly string[] {
  const names = [
    ...MESH_PRIMITIVES.filter(primitive => !primitive.disabled).flatMap(primitive =>
      geometryFields(primitive.create()).map(field => field.name),
    ),
    ...LIGHT_TYPES.flatMap(light => lightFields(light.create()).map(field => field.name)),
    ...materialFields(DEFAULT_MATERIAL, '#ffffff').map(field => field.name),
    ...spriteFields(DEFAULT_SPRITE, '#ffffff').map(field => field.name),
    ...textFields(DEFAULT_TEXT).map(field => field.name),
    ...cameraFields(DEFAULT_CAMERA).map(field => field.name),
    ...TEXTURE_SLOTS,
  ]

  return [...new Set(names)]
}

/**
 * `DescriptorSection` falls back to the raw field name when no translation exists — the right
 * call for a parameter that arrives from the API, and a silent leak for these, which are the
 * studio's own. A geometry gaining `heightSegments` would simply read `heightSegments`.
 */
function labelOf(code: Language, name: string): unknown {
  // Widened, not cast: the bundle's inferred type has no index signature, and the names being
  // looked up are read off the registries rather than written down beside it.
  const fields: unknown = TRANSLATIONS[code].inspector.fields
  return isRecord(fields) ? fields[name] : undefined
}

describe('the parameters the inspector draws', () => {
  it.each(LANGUAGES.map(language => language.code))('are all named in %s', code => {
    for (const name of everyFieldName()) {
      const label = labelOf(code, name)
      expect(typeof label === 'string' && label.trim() !== '', `${name} is missing`).toBe(true)
    }
  })

  it('reads the parameters off the registries, not off a list', () => {
    expect(everyFieldName().length).toBeGreaterThan(20)
  })
})
