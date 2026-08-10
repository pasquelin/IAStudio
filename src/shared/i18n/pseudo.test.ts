import { describe, expect, it } from 'vitest'
import { PSEUDO_LANGUAGE, pseudoLocalize, type Bundle } from './pseudo'
import { TRANSLATIONS } from './index'

/** The one leaf of a one-key bundle, so a test reads as a sentence about a string. */
function only(bundle: Bundle, key: string): string {
  const value = bundle[key]
  if (typeof value !== 'string') throw new Error(`${key} is not a leaf`)
  return value
}

describe('pseudoLocalize', () => {
  it('accents the letters a reader would recognise', () => {
    const localized = pseudoLocalize({ save: 'Save' })

    expect(only(localized, 'save')).toContain('Šávé')
  })

  it('brackets every string, so a sentence glued from two keys shows its seam', () => {
    const localized = pseudoLocalize({ half: 'Delete', rest: 'the project' })

    expect(only(localized, 'half').startsWith('⟦')).toBe(true)
    expect(only(localized, 'half').endsWith('⟧')).toBe(true)
    expect(`${only(localized, 'half')}${only(localized, 'rest')}`).toContain('⟧⟦')
  })

  it('lengthens the text, because the layout has to survive a longer language', () => {
    const localized = pseudoLocalize({ save: 'Save' })

    expect(only(localized, 'save').length).toBeGreaterThan('Save'.length + 2)
  })

  // The whole point of a hole is that a caller fills it: accenting the name would leave
  // i18next looking for a variable nobody passes, and the string would render as itself.
  it('leaves the interpolation holes exactly as they were', () => {
    const localized = pseudoLocalize({ count: '{{count}} assets selected' })

    expect(only(localized, 'count')).toContain('{{count}}')
  })

  it('leaves the tags of a rich translation alone', () => {
    const localized = pseudoLocalize({ terms: 'Read the <1>licence</1> first' })

    expect(only(localized, 'terms')).toContain('<1>')
    expect(only(localized, 'terms')).toContain('</1>')
  })

  it('walks the nested groups the bundles are written in', () => {
    const localized = pseudoLocalize({ panels: { assets: 'Assets' } })
    const panels = localized.panels

    if (typeof panels !== 'object') throw new Error('panels flattened')
    expect(only(panels, 'assets')).toContain('Áššétš')
  })

  it('keeps the shape of the real bundle, key for key', () => {
    const localized = pseudoLocalize(TRANSLATIONS.fr)

    expect(keysOf(localized)).toEqual(keysOf(TRANSLATIONS.fr))
  })

  // A bundle with an untouched leaf is a bundle that would read as hardcoded text on screen —
  // the exact defect this locale exists to catch, hiding inside the detector itself.
  it('leaves no leaf of the real bundle unmarked', () => {
    const localized = pseudoLocalize(TRANSLATIONS.fr)

    expect(leavesOf(localized).filter(leaf => !leaf.startsWith('⟦'))).toEqual([])
  })
})

function keysOf(bundle: Bundle, prefix = '', into: string[] = []): string[] {
  for (const [key, value] of Object.entries(bundle)) {
    const path = prefix ? `${prefix}.${key}` : key
    into.push(path)
    if (typeof value !== 'string') keysOf(value, path, into)
  }

  return into
}

function leavesOf(bundle: Bundle, into: string[] = []): string[] {
  for (const value of Object.values(bundle)) {
    if (typeof value === 'string') into.push(value)
    else leavesOf(value, into)
  }

  return into
}

/**
 * The code is handed to `Intl` by every formatter the window builds — `i18n.language` is what
 * `timeAgo`, the usage figures and the activity clock all pass through. A tag `Intl` cannot
 * parse throws a `RangeError` on the first date drawn, so the detector would die on the screens
 * it exists to inspect. Six letters is a well-formed primary subtag; one letter is not.
 */
describe('the code the pseudo bundle is registered under', () => {
  it('is a tag every Intl formatter accepts', () => {
    expect(() => new Intl.RelativeTimeFormat(PSEUDO_LANGUAGE)).not.toThrow()
    expect(() => new Intl.NumberFormat(PSEUDO_LANGUAGE)).not.toThrow()
    expect(() => new Intl.DateTimeFormat(PSEUDO_LANGUAGE)).not.toThrow()
  })

  // Unknown to CLDR, so a formatter falls back to the environment's own locale rather than
  // pretending the pseudo-locale has date and number rules of its own.
  it('is not a language anything claims to support', () => {
    expect(Intl.NumberFormat.supportedLocalesOf([PSEUDO_LANGUAGE])).toEqual([])
  })
})
