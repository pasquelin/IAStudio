import { kept } from '@/helpers/format'
import { clamp } from '@shared/numeric'

const NUMBERS = new Map<string, Intl.NumberFormat>()
const DATES = new Map<string, Intl.DateTimeFormat>()

/**
 * Compute Units, grouped for reading.
 *
 * Decimals only below ten: a studio racks up thousands, where a fractional unit is noise, but a
 * single cheap call costs a fraction and rounding it to zero would read as "this was free".
 */
export function formatUnits(units: number, locale: string): string {
  const digits = units !== 0 && Math.abs(units) < 10 ? 2 : 0

  return kept(
    NUMBERS,
    `units:${digits}:${locale}`,
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }),
  ).format(units)
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  return kept(
    NUMBERS,
    `money:${currency}:${locale}`,
    () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
  ).format(amount)
}

/** Short enough that a hundred and twenty of them can share one axis. */
export function formatDay(date: string, locale: string): string {
  // Read as UTC: the API dates its points there, and a local reading shifts a day at each end.
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return kept(
    DATES,
    `day:${locale}`,
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  ).format(parsed)
}

export function formatMoment(time: string, locale: string): string {
  const parsed = new Date(time)
  if (Number.isNaN(parsed.getTime())) return time

  return kept(
    DATES,
    `moment:${locale}`,
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
  ).format(parsed)
}

/**
 * The share one row holds of the largest row, as a percentage for a bar's width.
 *
 * Against the largest rather than the total: a table of proportions where the top row fills a
 * tenth of its cell is unreadable, and the ranking is what these bars are for.
 */
export function shareOf(value: number, largest: number): number {
  if (largest <= 0) return 0
  return clamp((value / largest) * 100, 0, 100)
}
