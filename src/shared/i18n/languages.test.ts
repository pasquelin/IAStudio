import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  effectiveLanguage,
  LANGUAGE_PREFERENCES,
  LANGUAGES,
  resolveLanguage,
} from './languages'

describe('resolving a machine tag', () => {
  it('keeps only the primary subtag, which is all that names a language', () => {
    expect(resolveLanguage('fr-CA')).toBe('fr')
    expect(resolveLanguage('en-GB')).toBe('en')
  })

  /**
   * English rather than French, and the two are not the same decision. A reader whose machine
   * is set to German, Spanish or Japanese is far likelier to read English than French, and the
   * studio is the only thing standing between them and a window they cannot use — they would
   * have to find the settings, in French, to discover that English exists.
   */
  it('serves English to a machine set to neither language', () => {
    expect(resolveLanguage('de-DE')).toBe('en')
    expect(resolveLanguage('es-ES')).toBe('en')
    expect(resolveLanguage('ja-JP')).toBe('en')
    expect(resolveLanguage(undefined)).toBe('en')
  })

  // The bundle a missing key falls back to stays French: it is the reference, and the fullest.
  it('keeps French as the bundle behind a key nobody translated', () => {
    expect(DEFAULT_LANGUAGE).toBe('fr')
  })
})

describe('the language in force', () => {
  // Both processes go through this. A machine tag read on one side only is how a native menu
  // ends up in a different language from the window under it.
  it('takes the machine tag only when the setting defers to it', () => {
    expect(effectiveLanguage('system', 'en-GB')).toBe('en')
    expect(effectiveLanguage('fr', 'en-GB')).toBe('fr')
  })

  it('ignores a machine tag it cannot honour, and serves English instead', () => {
    expect(effectiveLanguage('system', 'de-DE')).toBe('en')
  })
})

describe('what the setting may hold', () => {
  it('offers every translated language, plus deferring to the machine', () => {
    expect(LANGUAGE_PREFERENCES).toEqual(['system', ...LANGUAGES.map(entry => entry.code)])
  })

  // Shown as-is in the settings: a language names itself in its own language, so these are the
  // one set of labels no bundle translates.
  it('names each language in that language', () => {
    for (const language of LANGUAGES) {
      expect(language.name.trim(), `${language.code} has no name`).not.toBe('')
    }
  })
})
