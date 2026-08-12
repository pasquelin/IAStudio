/**
 * The characters French typography needs and a keyboard does not offer.
 *
 * Written as escapes on purpose: a literal no-break space is indistinguishable from an ordinary
 * one in a diff, in a review, and in the test that compares against it — which is exactly how it
 * gets lost. `bundles.test.ts` refuses an ordinary space before `;` `:` `!` `?` and `»`.
 */
export const NO_BREAK_SPACE = '\u00a0'

const ORDINARY = '\u0020'

/**
 * The symbols the studio writes after a number, and nothing else.
 *
 * A WORD is not one: French writes `2 derniers`, `3 assets`, `24 étapes`, and that space may
 * break — some fifty of them do. Telling `Mo` from `au` is what needs a list, and it is why this
 * one is written out rather than derived. A new unit goes in here, with the value that introduced
 * it; `o`, `Kio`, `Mio` and `Gio` are what `units.*` renders through `formatBytes`.
 */
export const UNIT_SYMBOLS: readonly string[] = [
  'UC',
  'o',
  'Kio',
  'Mio',
  'Gio',
  'Mo',
  'j',
  'h',
  'LUFS',
]

/** Multiplication ties to BOTH numbers: bound on the left alone, the second one leaves the line. */
const TIMES = '×'

const escaped = (symbol: string): string => symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const UNIT = `(?:${[...UNIT_SYMBOLS, TIMES].map(escaped).join('|')})`

/**
 * Every ordinary space French would not break there, named by what it separates.
 *
 * The interpolation counts as a number — `{{units}} UC` is the most frequent readout the studio
 * draws, and no pattern looking for a digit ever saw it.
 */
export function breakableSpots(text: string): string[] {
  const rules: readonly { pattern: RegExp; what: string }[] = [
    {
      pattern: new RegExp(`(?:\\d+|\\}\\})${ORDINARY}${UNIT}(?![\\p{Letter}\\d])`, 'gu'),
      what: 'unit',
    },
    { pattern: new RegExp(`${TIMES}${ORDINARY}(?=\\d|\\{\\{)`, 'gu'), what: 'times' },
    { pattern: new RegExp(`\\d${ORDINARY}(?=\\d{3}(?!\\d))`, 'gu'), what: 'thousands' },
    { pattern: new RegExp(`${ORDINARY}[;:!?»]`, 'gu'), what: 'punctuation' },
    { pattern: new RegExp(`«${ORDINARY}`, 'gu'), what: 'quote' },
  ]

  return rules.flatMap(({ pattern, what }) =>
    [...text.matchAll(pattern)].map(match => `${what}: ${match[0].trim()}`),
  )
}
