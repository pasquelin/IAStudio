import { describe, expect, it } from 'vitest'
import { LANGUAGES, TRANSLATIONS } from '@shared/i18n'
import { BYTE_UNITS, formatBytes, type ByteUnit } from './format'

const name = (unit: ByteUnit): string => unit

describe('sizing a file', () => {
  it('counts in kibibytes, like the file managers it sits beside', () => {
    expect(formatBytes(512, name)).toBe('512 byte')
    expect(formatBytes(1024, name)).toBe('1.0 kibibyte')
    expect(formatBytes(1024 * 1024 * 4.2, name)).toBe('4.2 mebibyte')
  })

  it('stops rounding to a tenth once the number is wide enough to read', () => {
    expect(formatBytes(1024 * 42, name)).toBe('42 kibibyte')
  })

  // Beyond the last unit the value keeps growing rather than naming a unit nothing translates.
  it('holds at the largest unit it knows', () => {
    expect(formatBytes(1024 ** 5, name)).toBe('1048576 gibibyte')
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
