/**
 * One formatter per shape and language, kept — the shared `kept` holds them.
 *
 * Building an `Intl` formatter per call costs 48 µs against 4, which a hundred-line log and a
 * hundred-and-twenty-point axis would both pay on the UI thread. Those two surfaces are what
 * the figure was measured on; the cache moved, the reason did not.
 */
import { clamp } from '@shared/numeric'
import { kept } from '@/helpers/format'

const NUMBERS = new Map<string, Intl.NumberFormat>()
const DATES = new Map<string, Intl.DateTimeFormat>()

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
