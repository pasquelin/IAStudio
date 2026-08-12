/**
 * One formatter per shape and language, kept — the only cache the window's formatters use.
 *
 * Building an `Intl` formatter per call costs 48 µs against 4, measured on a hundred-line log
 * and a hundred-and-twenty-point axis. Keys name the shape as well as the language, so two
 * shapes never share an entry.
 */
export function kept<T>(cache: Map<string, T>, key: string, build: () => T): T {
  const held = cache.get(key)
  if (held) return held

  const built = build()
  cache.set(key, built)
  return built
}

const LISTS = new Map<string, Intl.ListFormat>()

/**
 * How the last two items are joined — and it is NOT a house style, it is what the sentence means.
 *
 * `conjunction` for things all true at once: the shelves a generation landed in, the accounts that
 * answered nothing. `disjunction` for alternatives: a filter that keeps a line whose level is ANY
 * of those listed, a port that accepts any of several types. Writing "et" over a disjunction
 * describes a filter no line can satisfy — which the bare comma it replaced at least left open.
 */
export type ListJoin = 'conjunction' | 'disjunction'

/**
 * A list of names, joined the way the reader's language joins one.
 *
 * `join(', ')` is the same mistake `formatPercent` was written against, one level up: the word
 * between the last two items belongs to the language, not to the component. French writes
 * "Image et 3D", English "Image and 3D" with its Oxford comma at three, and three call sites each
 * wrote a bare comma — so every reader of every language got the enumeration of none of them.
 *
 * `join` has no default on purpose. A comma hides the difference between "all of these" and "any
 * of these"; a word cannot, so every caller has to have decided which it means.
 */
export function formatList(items: readonly string[], language: string, join: ListJoin): string {
  // The shape belongs in the key, as `kept` asks: two joins are two formatters for one language.
  return kept(
    LISTS,
    `${join}:${language}`,
    () => new Intl.ListFormat(language, { style: 'long', type: join }),
  ).format(items)
}

const PERCENTS = new Map<string, Intl.NumberFormat>()

/**
 * A ratio, read as a percentage in the reader's language.
 *
 * The space before the sign belongs to the language, not to the component: French writes a
 * non-breaking one, English writes none — and three call sites had each picked one by hand,
 * which shipped the French spacing to English readers.
 *
 * Thousands are left ungrouped: the only percentage the studio takes past a thousand is a zoom
 * level, where a separator inside `1250 %` reads as a second number rather than as one step.
 */
export function formatPercent(ratio: number, language: string, fractionDigits: number = 0): string {
  return kept(
    PERCENTS,
    `percent:${fractionDigits}:${language}`,
    () =>
      new Intl.NumberFormat(language, {
        style: 'percent',
        maximumFractionDigits: fractionDigits,
        useGrouping: false,
      }),
  ).format(ratio)
}

const MOMENTS = new Map<string, Intl.DateTimeFormat>()

/**
 * A point in time, read the way the reader reads one — date and clock, no seconds.
 *
 * It moved here from the usage window, which was the only surface to have decided what a
 * timestamp looks like. The asset inspector was drawing its own with a bare `toLocaleString`,
 * so the studio showed two shapes for one thing, and one of them built a formatter per render.
 *
 * A date the API sent unparseable is handed back untouched: a row missing its stamp still names
 * what happened, which `Invalid Date` in the reader's language does not.
 */
export function formatMoment(time: string, language: string): string {
  const parsed = new Date(time)
  if (Number.isNaN(parsed.getTime())) return time

  return kept(
    MOMENTS,
    language,
    () => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }),
  ).format(parsed)
}

const DECIMALS = new Map<string, Intl.NumberFormat>()

/**
 * A number, written the way the reader writes one.
 *
 * `toFixed` is not a formatter, it is a rounder that happens to return a string — and the string
 * it returns is always English: `0.52` where French reads `0,52`. Every number the studio drew
 * outside this file went out that way.
 *
 * `least` is what a slider needs and a readout does not: a handle dragged past 1,20 must not
 * shorten to 1,2 and back, while a coordinate of exactly 1 has no business reading 1,00.
 *
 * `grouped` is asked for rather than inherited, which is the whole reason this takes a shape
 * instead of three numbers: a file size reads better as `1 048 576`, a ruler graduation does
 * not — its labels sit a few pixels apart, and a separator there is a second number.
 */
export type DecimalShape = {
  digits: number
  /** Zeros to keep when the value has none of its own. */
  least?: number
  grouped?: boolean
}

export function formatDecimal(
  value: number,
  language: string | undefined,
  shape: DecimalShape,
): string {
  const { digits, least = 0, grouped = true } = shape

  return kept(
    DECIMALS,
    `decimal:${digits}:${least}:${grouped}:${language}`,
    () =>
      new Intl.NumberFormat(language, {
        maximumFractionDigits: digits,
        minimumFractionDigits: least,
        useGrouping: grouped,
      }),
  ).format(value)
}

/** The four the studio ever reaches: an asset larger than a tebibyte is not a thing it makes. */
export type ByteUnit = 'byte' | 'kibibyte' | 'mebibyte' | 'gibibyte'

export const BYTE_UNITS: readonly ByteUnit[] = ['byte', 'kibibyte', 'mebibyte', 'gibibyte']

/**
 * Kibibytes, like every file manager on every desktop the studio runs on.
 *
 * The unit is named by the caller rather than written here: `Mio` and `MiB` are the same size
 * in two languages, and the abbreviations lived in this file in French only.
 */
export function formatBytes(
  bytes: number,
  unitName: (unit: ByteUnit) => string,
  language: string,
): string {
  let value = bytes
  let unit: ByteUnit = 'byte'

  for (const next of BYTE_UNITS.slice(1)) {
    if (value < 1024) break
    value /= 1024
    unit = next
  }

  // One decimal below ten, none above: `1,5 Mio` says something `2 Mio` does not, and `847,3 Mio`
  // says nothing `847 Mio` did not. Kept even when it is a zero — a download counter refreshing
  // from `1 Gio` to `1,1 Gio` would jump a character wide under a `tabular-nums` column.
  const digits = value < 10 && unit !== 'byte' ? 1 : 0
  return `${formatDecimal(value, language, { digits, least: digits })} ${unitName(unit)}`
}

/**
 * A number as a person typed it.
 *
 * The comma is not a preference, it is the key: on a French keyboard the numeric pad's decimal
 * key produces `,`, so `0,5` is what a hand types by default. `Number` reads that as `NaN`, and
 * the field it lands in refuses non-finite values — the gesture failed in silence, leaving the
 * old value behind on blur.
 *
 * Both separators are taken, in every language: a studio is used with two keyboards more often
 * than it is used in two languages, and no locale writes both.
 */
export function parseDecimal(text: string): number {
  return Number(text.replace(',', '.'))
}
