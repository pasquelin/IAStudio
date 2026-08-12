import { describe, expect, it, vi } from 'vitest'
import { LANGUAGES, TRANSLATIONS } from '@shared/i18n'
import {
  BYTE_UNITS,
  formatBytes,
  formatDecimal,
  formatPercent,
  kept,
  formatList,
  type ByteUnit,
} from './format'

const name = (unit: ByteUnit): string => unit

describe('reading a percentage', () => {
  // The defect this closed: the French spacing was written into three components, so an English
  // reader was shown `42 %`, which their typography does not have. The separator French uses is
  // U+00A0, written as an escape here because it reads as a plain space in an editor.
  it('spaces the sign the way the language does', () => {
    expect(formatPercent(0.42, 'fr')).toBe('42\u00a0%')
    expect(formatPercent(0.42, 'en')).toBe('42%')
  })

  it('rounds to whole percents unless asked for more', () => {
    expect(formatPercent(0.4249, 'en')).toBe('42%')
    expect(formatPercent(0.037, 'en', 1)).toBe('3.7%')
  })

  // A decimal place asked for is a maximum, not a padding: 100 % must not read as 100.0 %.
  it('drops a decimal it does not need', () => {
    expect(formatPercent(1, 'en', 1)).toBe('100%')
  })

  // A zoom is the only percentage that goes past a thousand, and a grouped one reads as two.
  it('leaves the thousands ungrouped', () => {
    expect(formatPercent(12.5, 'en')).toBe('1250%')
  })

  // `pseudo` is the pseudo-locale's tag, and it reaches here as `i18n.language` like any other.
  it('answers for a language tag no region defines', () => {
    expect(() => formatPercent(0.42, 'pseudo')).not.toThrow()
  })
})

describe('keeping a formatter', () => {
  // 48 µs against 4: a progress bar repainting on every job tick pays it on the UI thread.
  it('builds one per key and holds it', () => {
    const cache = new Map<string, string>()
    const build = vi.fn(() => 'built')

    expect(kept(cache, 'a', build)).toBe('built')
    expect(kept(cache, 'a', build)).toBe('built')
    expect(kept(cache, 'b', build)).toBe('built')

    expect(build).toHaveBeenCalledTimes(2)
  })
})

describe('sizing a file', () => {
  it('counts in kibibytes, like the file managers it sits beside', () => {
    expect(formatBytes(512, name, 'en')).toBe('512 byte')
    expect(formatBytes(1024, name, 'en')).toBe('1.0 kibibyte')
    expect(formatBytes(1024 * 1024 * 4.2, name, 'en')).toBe('4.2 mebibyte')
  })

  // The separator belongs to the language: `4.2` is a wrong number to a French reader, not a
  // differently written one.
  it('writes the tenth the way the reader writes one', () => {
    expect(formatBytes(1024 * 1024 * 4.2, name, 'fr')).toBe('4,2 mebibyte')
  })

  it('stops rounding to a tenth once the number is wide enough to read', () => {
    expect(formatBytes(1024 * 42, name, 'en')).toBe('42 kibibyte')
  })

  // Beyond the last unit the value keeps growing rather than naming a unit nothing translates.
  it('holds at the largest unit it knows', () => {
    expect(formatBytes(1024 ** 5, name, 'en')).toBe('1,048,576 gibibyte')
  })
})

describe('writing a number', () => {
  it('uses the separator of the language it was asked for', () => {
    expect(formatDecimal(0.5235, 'fr', { digits: 2 })).toBe('0,52')
    expect(formatDecimal(0.5235, 'en', { digits: 2 })).toBe('0.52')
  })

  // A slider at 1 must read `1`: `toFixed` was dropped for the separator, not to gain `1,00`.
  it('drops the zeros a whole number does not need', () => {
    expect(formatDecimal(1, 'fr', { digits: 2 })).toBe('1')
    expect(formatDecimal(1.5, 'fr', { digits: 2 })).toBe('1,5')
  })
})

describe('the unit names', () => {
  // `Mio` and `MiB` are the same size in two languages: they lived in the helper, in French.
  it.each(LANGUAGES.map(language => language.code))('are translated in %s', code => {
    for (const unit of BYTE_UNITS) {
      expect(TRANSLATIONS[code].units[unit].trim(), `units.${unit} is missing`).not.toBe('')
    }
  })
})

describe('keeping a slider steady', () => {
  // A handle dragged past 1,20 must not shorten to 1,2 and back: the number is read while it moves.
  it('keeps the zeros a step implies', () => {
    expect(formatDecimal(1.2, 'fr', { digits: 2, least: 2 })).toBe('1,20')
    expect(formatDecimal(1, 'fr', { digits: 2, least: 2 })).toBe('1,00')
  })
})

describe('a list of names, joined by the language', () => {
  /*
   * The whole point, and the reason `join(', ')` was a defect rather than a shortcut: the word
   * between the last two items differs per language, and no component can know it.
   */
  it('writes the conjunction French writes', () => {
    expect(formatList(['Image', '3D'], 'fr', 'conjunction')).toBe('Image et 3D')
    expect(formatList(['Image', '3D', 'Vidéo'], 'fr', 'conjunction')).toBe('Image, 3D et Vidéo')
  })

  it('writes the one English writes, which is not the same word or the same comma', () => {
    expect(formatList(['Image', '3D'], 'en', 'conjunction')).toBe('Image and 3D')
    expect(formatList(['Image', '3D', 'Video'], 'en', 'conjunction')).toBe('Image, 3D, and Video')
  })

  /*
   * The half a comma hid, and the reason the join has no default: a filter that keeps a line whose
   * level is ANY of those chosen is a disjunction, and calling it "et" names a filter no line can
   * meet. One word apart, opposite meanings.
   */
  it('writes the alternative when the sentence offers one', () => {
    expect(formatList(['Avertissement', 'Échec'], 'fr', 'disjunction')).toBe(
      'Avertissement ou Échec',
    )
    expect(formatList(['Warning', 'Failure'], 'en', 'disjunction')).toBe('Warning or Failure')
  })

  // Two joins are two formatters for one language: keyed by language alone, the second call
  // would hand back the first's word.
  it('keeps a formatter per join, not per language', () => {
    expect(formatList(['a', 'b'], 'fr', 'conjunction')).toBe('a et b')
    expect(formatList(['a', 'b'], 'fr', 'disjunction')).toBe('a ou b')
  })

  // One name is not a list, and no separator belongs anywhere near it.
  it('leaves a single name alone, and answers nothing for none', () => {
    expect(formatList(['Image'], 'fr', 'conjunction')).toBe('Image')
    expect(formatList([], 'fr', 'conjunction')).toBe('')
  })
})
