/**
 * What a model is told when the studio is on a pixel grid. English and literal, OUTSIDE the i18n
 * bundles on purpose — the same arbitration as `composedContext`: a prompt is code, and putting
 * it in a bundle invites somebody to translate the one thing that must not move.
 *
 * `x` is ASCII and not `×`: a non-ASCII character in a JSON body and in a CLIP tokenizer.
 */
export function pixelArtWords(columns: number, rows: number): string {
  return `pixel art, ${columns}x${rows} sprite, hard edges, no anti-aliasing`
}

/**
 * Bounded by construction — the two counts are the only variables, and a side is capped at the
 * document's own. It does not travel through `composedContext`, so it does not eat the 600
 * characters that one is held to; it does share the 77-token window those exist to protect.
 */
export const PIXEL_ART_PROMPT_MAX = 90

/**
 * 🛑 The WORD, never the substring: « no pixel artifacts » and « a pixel artist » both carry
 * « pixel art ». One reader for the whole studio — `suitsPixelArt` asked the same question and
 * answered it differently, which is two truths about one genre in one folder.
 */
const SAID = /pixel[\s-]?art(?![a-z])/i

export const saysPixelArt = (text: string): boolean => SAID.test(text)

/**
 * The written prompt with the grid said after it. 🛑 Idempotent, and that is not a nicety: the
 * catalogue keeps what was WRITTEN, and from the main's side that already includes these words —
 * the window put them there before the IPC. A regeneration would double them, then triple them.
 *
 * Blank in, blank out — the same arbitration as `bodyWithContext`: a style is a modifier, not a
 * subject, and « pixel art, 64x64 sprite » alone is a prompt nobody wrote.
 */
export function withPixelArtPrompt(written: string, columns: number, rows: number): string {
  const subject = written.trim()
  if (subject.length === 0 || saysPixelArt(subject)) return written

  return `${subject}, ${pixelArtWords(columns, rows)}`
}
