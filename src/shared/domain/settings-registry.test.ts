import { describe, expect, it } from 'vitest'
import { isRecord } from '../guards'
import { LANGUAGES, TRANSLATIONS } from '../i18n'
import { defaultAt } from './settings-path'
import {
  boundsOf,
  descriptorAt,
  descriptorsIn,
  matchSettings,
  optionsOf,
  SETTING_REGISTRY,
  UNLISTED_PATHS,
} from './settings-registry'

function resolve(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

function keysOf(): string[] {
  return SETTING_REGISTRY.flatMap(descriptor => [
    descriptor.titleKey,
    descriptor.helpKey,
    ...(descriptor.placeholderKey ? [descriptor.placeholderKey] : []),
    ...optionsOf(descriptor).map(option => option.labelKey),
  ])
}

describe('settings registry', () => {
  it('describes each setting once', () => {
    const paths = SETTING_REGISTRY.map(descriptor => descriptor.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('never lists a path as both described and deliberately unlisted', () => {
    const described = new Set<string>(SETTING_REGISTRY.map(descriptor => descriptor.path))
    expect(UNLISTED_PATHS.filter(path => described.has(path))).toEqual([])
  })

  // The point of the whole registry: a setting nobody can explain is a setting nobody can use.
  it.each(LANGUAGES.map(language => language.code))('says what every setting does in %s', code => {
    for (const key of keysOf()) {
      const text = resolve(TRANSLATIONS[code], key)
      expect(typeof text === 'string' && text.trim() !== '', `${key} is missing`).toBe(true)
    }
  })

  it('explains, and does not merely repeat the title', () => {
    for (const descriptor of SETTING_REGISTRY) {
      const help = resolve(TRANSLATIONS.fr, descriptor.helpKey)
      // Short enough to be a label rather than an explanation, which is what this guards.
      expect(
        String(help).length,
        `${descriptor.helpKey} is too short to explain anything`,
      ).toBeGreaterThan(40)
    }
  })

  it('bounds every numeric setting, so zod never falls back to infinity', () => {
    for (const descriptor of SETTING_REGISTRY) {
      if (descriptor.kind !== 'number' && descriptor.kind !== 'slider') continue

      const bounds = boundsOf(descriptor.path)
      expect(Number.isFinite(bounds.min), `${descriptor.path} has no minimum`).toBe(true)
      expect(Number.isFinite(bounds.max), `${descriptor.path} has no maximum`).toBe(true)
    }
  })

  // A default outside the list leaves the control showing a blank the user cannot restore.
  it('offers the default of every choice among its options', () => {
    for (const descriptor of SETTING_REGISTRY) {
      if (descriptor.kind !== 'choice') continue

      const values = optionsOf(descriptor).map(option => option.value)
      expect(values, `${descriptor.path}`).toContain(defaultAt(descriptor.path))
    }
  })

  it('keeps a numeric default within the bounds it declares', () => {
    for (const descriptor of SETTING_REGISTRY) {
      if (descriptor.kind !== 'number' && descriptor.kind !== 'slider') continue

      const value = defaultAt(descriptor.path)
      const bounds = boundsOf(descriptor.path)
      expect(typeof value === 'number' && value >= bounds.min && value <= bounds.max).toBe(true)
    }
  })

  it('groups settings by the screen that shows them', () => {
    expect(descriptorsIn('appearance').map(descriptor => descriptor.path)).toEqual([
      'appearance.theme',
      'appearance.density',
    ])
  })

  it('finds a descriptor by path, and nothing for one it does not describe', () => {
    expect(descriptorAt('appearance.theme')?.kind).toBe('choice')
    expect(descriptorAt('storage.lastProject')).toBeNull()
  })

  it('leaves bounds open for a setting that declares none', () => {
    expect(boundsOf('media.ffmpegPath').max).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('settings search', () => {
  const translate = (key: string): string => String(resolve(TRANSLATIONS.fr, key) ?? key)

  it('finds a setting by its title', () => {
    expect(matchSettings('densité', translate).map(entry => entry.path)).toEqual([
      'appearance.density',
    ])
  })

  // A search box demanding a circumflex is a search box nobody uses.
  it('ignores accents and case', () => {
    expect(matchSettings('DENSITE', translate).map(entry => entry.path)).toEqual([
      'appearance.density',
    ])
  })

  it('searches the description too, where the words a user knows actually are', () => {
    expect(matchSettings('réseau', translate).map(entry => entry.path)).toEqual([
      'generation.maxRetries',
    ])
  })

  it('answers nothing to an empty query rather than everything', () => {
    expect(matchSettings('   ', translate)).toEqual([])
  })

  it('answers nothing when no setting matches', () => {
    expect(matchSettings('kerning', translate)).toEqual([])
  })
})
