/**
 * How this repository reads a menu path, in ONE place — `manual.i18n.test.ts` asks it of the
 * twenty chapters the Help window renders, `bundles.test.ts` of the bundles themselves. Written
 * out twice, the two readings would drift, and the manual's has already been widened three times.
 */
import { isRecord } from '../guards'

/**
 * Both separators the chapters write, and they are not interchangeable to a regexp: `▸` carries
 * the paths, `›` a handful. `→` marks a DIRECTION and stays out — adding it returned six French
 * and ten English fragments of sentences, measured.
 *
 * ONE line break at most, and the `\S` edges are what make crossing it safe: `**` pairs greedily,
 * so without them the reading starts on a CLOSING `**` and runs to the next line's opening one,
 * returning half a table row as a path — measured. Refusing the break outright was the other
 * failure: a path a reflow had split was quoted correctly and read by nobody.
 */
export const MENU_PATH =
  /\*\*(?=\S)((?:[^*\n]|\n(?!\s*\n)){1,90}[▸›](?:[^*\n]|\n(?!\s*\n)){1,90})(?<=\S)\*\*/g

/** A path a reflow split reads as one line, the break being of the page and not of the menu. */
export const menuPathsOf = (markdown: string): string[] =>
  [...markdown.matchAll(MENU_PATH)].flatMap(match => (match[1] ?? '').replace(/\s*\n\s*/g, ' '))

/** As a reader compares a quote to a menu: trailing ellipsis dropped, holes dropped, folded. */
export const asRead = (text: string): string =>
  text
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/[….]+$/, '')
    .trim()
    .toLowerCase()

export const screenLabels = (bundle: unknown, into = new Set<string>()): Set<string> => {
  if (typeof bundle === 'string') into.add(asRead(bundle))
  else if (isRecord(bundle)) for (const held of Object.values(bundle)) screenLabels(held, into)

  return into
}

/** What ends a quoted path inside a sentence — everything else is read as part of a label. */
const SENTENCE_BOUND = /[.,;:!?()«»"“”—–\n]/

const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean)

/** The longest run of words at that end which the screen carries as a label, if any. */
const labelAt = (text: string, at: 'start' | 'end', labels: ReadonlySet<string>): boolean => {
  const words = wordsOf(text)

  return words.some((_, index) =>
    labels.has(asRead((at === 'end' ? words.slice(index) : words.slice(0, index + 1)).join(' '))),
  )
}

/**
 * A path quoted in a BUNDLE wears no bold — nothing sets it apart from the sentence around it —
 * so the reading slides outwards from the separator and keeps the longest run each side that is a
 * label. `▸` in a bundle can only be a menu path, which is what makes sliding safe here and not
 * in the manual, where prose arrows abound.
 */
export const unquotedMenuSegments = (value: string, labels: ReadonlySet<string>): string[] =>
  value
    .split(SENTENCE_BOUND)
    .filter(window => /[▸›]/.test(window))
    .flatMap(window => {
      const parts = window.split(/[▸›]/)

      return parts
        .filter((part, index) =>
          index === 0
            ? !labelAt(part, 'end', labels)
            : index === parts.length - 1
              ? !labelAt(part, 'start', labels)
              : !labels.has(asRead(part)),
        )
        .map(part => `"${part.trim()}" in ${window.trim()}`)
    })
