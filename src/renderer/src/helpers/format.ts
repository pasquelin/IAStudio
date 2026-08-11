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

/** The four the studio ever reaches: an asset larger than a tebibyte is not a thing it makes. */
export type ByteUnit = 'byte' | 'kibibyte' | 'mebibyte' | 'gibibyte'

export const BYTE_UNITS: readonly ByteUnit[] = ['byte', 'kibibyte', 'mebibyte', 'gibibyte']

/**
 * Kibibytes, like every file manager on every desktop the studio runs on.
 *
 * The unit is named by the caller rather than written here: `Mio` and `MiB` are the same size
 * in two languages, and the abbreviations lived in this file in French only.
 */
export function formatBytes(bytes: number, unitName: (unit: ByteUnit) => string): string {
  let value = bytes
  let unit: ByteUnit = 'byte'

  for (const next of BYTE_UNITS.slice(1)) {
    if (value < 1024) break
    value /= 1024
    unit = next
  }

  const rounded = value < 10 && unit !== 'byte' ? value.toFixed(1) : Math.round(value)
  return `${rounded} ${unitName(unit)}`
}
