import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'
import { SECTIONS } from './sections'

function resolve(code: Language, key: string): unknown {
  // Widened, not cast: the bundle's inferred type carries no index signature, and the keys here
  // are composed from the section list rather than written down beside it.
  const bundle: unknown = TRANSLATIONS[code]
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

/**
 * The window names each section twice — once in the rail, once as the heading above its
 * description — and both keys are composed at runtime, so a section added without them shows
 * `usage.sections.<id>` where a title belongs.
 */
describe('the sections of the usage window', () => {
  it.each(LANGUAGES.map(language => language.code))('are named and described in %s', code => {
    for (const section of SECTIONS) {
      for (const key of [`usage.sections.${section}`, `usage.descriptions.${section}`]) {
        const text = resolve(code, key)
        expect(typeof text === 'string' && text.trim() !== '', `${key} is missing`).toBe(true)
      }
    }
  })
})
