/**
 * What a person typed, as an fts5 query — or `null` when nothing they typed is a word.
 *
 * Words only, and quoted: `-`, `*`, `AND` and `(` are operators in that grammar, and a name is
 * not a query. The trailing star is what makes a row appear while the word is still being typed,
 * which is the only reason a search runs on every keystroke at all. Every term must match, as
 * the tag filter does: filters narrow, they do not widen.
 *
 * `null` when nothing tokenises. Punctuation alone indexes to nothing, and fts5 cannot look for
 * what it never indexed: the caller falls back to a scan rather than answering that nothing
 * matched.
 */
export function matchExpression(text: string): string | null {
  return joined(text, ' AND ')
}

/**
 * 🛑 The same words as a QUESTION rather than as a filter — joined by OR, and ranked by bm25.
 *
 * A filter narrows: every term must match. A question does the opposite, and getting the two
 * confused is what made a recall answer nothing at all — « à quoi sert le script CameraRig ? »
 * demanded all thirteen of its words of one memory, and no memory has thirteen.
 */
export function askExpression(text: string): string | null {
  return joined(text, ' OR ')
}

/** The one tokeniser. The two above differ by their joiner and by nothing else. */
const joined = (text: string, joiner: string): string | null => {
  const terms = text.match(/[\p{L}\p{N}_]+/gu)
  return terms ? terms.map(term => `"${term}"*`).join(joiner) : null
}
