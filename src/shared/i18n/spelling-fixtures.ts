/**
 * Which English words the repository spells the British way, and which lookalikes it must leave
 * alone. Here rather than in each suite because it is the SAME knowledge two guards ask for —
 * `bundles.test.ts` reads the English bundle, `manual.i18n.test.ts` the twenty chapters the Help
 * window renders. Written out twice, an exemption added on one side alone would let the other
 * keep failing on a word the repository had already decided about.
 */

/**
 * `ize` is the root here, not the suffix, so no British twin exists — a guard that flagged
 * `resize` would cry wolf on the word the image workspace uses most. Anything built on `size`
 * comes with it: `oversized` and `downsize` belong to a manual that describes pictures, and
 * `capsize` shares the ending without sharing the word.
 */
const IZE_IS_THE_ROOT = /(?:size|seize|prize|maize)$/

/**
 * Anchored, so that it strips the SAME `iz` the match found: a word carrying two of them would
 * otherwise fold onto the wrong root and slip through exempt.
 */
const izeRootOf = (word: string): string =>
  word.toLowerCase().replace(/iz(?:es?|ed|ing|ations?|ers?)$/, 'ize')

/** Every `-ize` spelling of a verb that British English writes `-ise`, in the order read. */
export const americanVerbs = (text: string): string[] =>
  [...text.matchAll(/\b\w*?iz(?:es?|ed|ing|ations?|ers?)\b/gi)]
    .map(([word]) => word)
    .filter(word => !IZE_IS_THE_ROOT.test(izeRootOf(word)))

/**
 * The words whose British form the manual already settled on — measured, not guessed: `catalogue`
 * ×36, `colour` ×63, `centre` ×25, `greyscale` and `grey` ×38, `behaviour` ×5, `neighbour` ×5,
 * `cancelled` ×4, `favourite`.
 *
 * Two pairs are left out because British English uses BOTH spellings for different words, so an
 * American noun cannot be told from a correct one: `license`, which is the British verb beside the
 * noun `licence`, and `meter`, the instrument beside the unit `metre`.
 *
 * `dialogue` is the one the manual has not settled: four chapters say it and four say `dialog`,
 * which is also what Electron names the API. That is a terminology decision, not a spelling one.
 *
 * Asked of prose only, never of a bundle: measured over the English bundle, the only three hits
 * are `blend.color`, `blend.color-burn` and `blend.color-dodge`, spelled the way `mix-blend-mode`
 * spells them.
 */
const AMERICAN_FORMS: readonly string[] = [
  'color(?:s|ed|ing)?',
  'center(?:s|ed|ing)?',
  'gray(?:scale)?',
  'cancel(?:ed|ing)',
  'catalogs?',
  'behavior(?:s|al)?',
  'neighbor(?:s|ing|hood)?',
  'favorites?',
]

const AMERICAN_WORDS = new RegExp(`\\b(?:${AMERICAN_FORMS.join('|')})\\b`, 'gi')

/** Every American spelling of a word the repository writes the British way, in the order read. */
export const americanWords = (text: string): string[] =>
  [...text.matchAll(AMERICAN_WORDS)].map(([word]) => word)

/**
 * A markdown chapter with everything that is not read as prose taken out: fenced blocks first, so
 * that a backtick inside one cannot pair with another and swallow the text between them, then
 * inline code, the capture notes the collector leaves as HTML comments, and link targets.
 *
 * Spelling is asked of prose alone: the rest carries names the studio does not choose. Measured on
 * the English manual, dropping the code step alone turns the `Authorization` header of two
 * chapters into failures; the targets hold file paths, and `catalog.db` is one of them.
 */
export const proseOf = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\]\([^)]*\)/g, '] ')
