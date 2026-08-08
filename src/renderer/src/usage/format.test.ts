import { describe, expect, it } from 'vitest'
import { formatDay, formatMoney, formatUnits, shareOf } from './format'

describe('formatUnits', () => {
  it('groups thousands without pretending to a precision nobody spends', () => {
    expect(formatUnits(1240, 'fr-FR')).toMatch(/1\s?240/)
  })

  // Rounding a cheap call to zero would read as "this was free".
  it('keeps decimals for the small amounts a single call costs', () => {
    expect(formatUnits(0.25, 'en-US')).toBe('0.25')
  })

  it('writes a true zero as zero', () => {
    expect(formatUnits(0, 'en-US')).toBe('0')
  })
})

describe('formatMoney', () => {
  it('follows the locale, not the currency', () => {
    expect(formatMoney(12.4, 'EUR', 'en-US')).toBe('€12.40')
  })
})

describe('formatDay', () => {
  // Read as UTC: the API dates its points there, and a local reading shifts a day at each end.
  it('reads an ISO day without shifting it into the local zone', () => {
    expect(formatDay('2026-08-01', 'en-US')).toBe('Aug 1')
  })

  it('hands back anything it cannot parse rather than showing "Invalid Date"', () => {
    expect(formatDay('not-a-date', 'en-US')).toBe('not-a-date')
  })
})

describe('shareOf', () => {
  it('measures a row against the largest one', () => {
    expect(shareOf(25, 100)).toBe(25)
  })

  it('answers zero rather than dividing by nothing', () => {
    expect(shareOf(5, 0)).toBe(0)
  })
})
