/**
 * A bundle, seen from outside: nested groups of strings, as deep as the JSON goes. Written
 * structurally rather than as `typeof fr` so that walking it needs no cast — the precise type
 * of the French file says which keys exist, which is a question this transform never asks.
 */
export type Bundle = { readonly [key: string]: string | Bundle }

/** The language code the pseudo bundle is registered under. Never a language anyone reads. */
export const PSEUDO_LANGUAGE = 'pseudo'

/**
 * What an interpolation hole and a `<Trans>` tag look like. They are copied through untouched:
 * accenting `{{count}}` would break the render and prove nothing about the text around it.
 */
const PRESERVED = /(\{\{[^}]*\}\}|<\/?[^>]+>)/g

const ACCENTS: Record<string, string> = {
  a: 'á',
  c: 'ç',
  e: 'é',
  i: 'í',
  n: 'ñ',
  o: 'ó',
  s: 'š',
  u: 'ú',
  y: 'ý',
  A: 'Á',
  C: 'Ç',
  E: 'É',
  I: 'Í',
  N: 'Ñ',
  O: 'Ó',
  S: 'Š',
  U: 'Ú',
}

/** German runs about 30 % longer than French, and Finnish longer still. */
const EXPANSION = 1.3

/**
 * Accent, lengthen, bracket — three tells in one string, each answering a different question.
 *
 * Accents answer "did anyone translate this?": a word left in plain letters on screen was
 * written in a component instead of a bundle. Padding answers "does the layout survive a longer
 * language?" without shipping that language. Brackets answer "is this one sentence?": a phrase
 * built by gluing two keys shows its seam as `⟧⟦`, and no reading of the code shows that.
 */
function pseudoText(text: string): string {
  const parts = text.split(PRESERVED)
  const accented = parts
    .map((part, index) =>
      // Odd indices are the capture groups: the holes and tags, kept verbatim.
      index % 2 === 1 ? part : [...part].map(character => ACCENTS[character] ?? character).join(''),
    )
    .join('')

  const visible = text.replace(PRESERVED, '').length
  const padding = Math.max(0, Math.round(visible * (EXPANSION - 1)))

  return `⟦${accented}${padding > 0 ? ` ${'·'.repeat(padding)}` : ''}⟧`
}

/** The same bundle, key for key, with every leaf pseudo-localized. */
export function pseudoLocalize(bundle: Bundle): Bundle {
  const localized: Record<string, string | Bundle> = {}

  for (const [key, value] of Object.entries(bundle)) {
    localized[key] = typeof value === 'string' ? pseudoText(value) : pseudoLocalize(value)
  }

  return localized
}
