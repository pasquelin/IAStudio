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
