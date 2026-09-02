/**
 * What a model is told when the studio is on a pixel grid. English and literal, OUTSIDE the i18n
 * bundles on purpose — the same arbitration as `composedContext`: a prompt is code, and putting
 * it in a bundle invites somebody to translate the one thing that must not move.
 *
 * `x` is ASCII and not `×`: a non-ASCII character in a JSON body and in a CLIP tokenizer.
 */
function pixelArtWords(columns: number, rows: number): string {
  return `pixel art, ${columns}x${rows} sprite, hard edges, no anti-aliasing`
}

/**
 * Bounded by construction — the two counts are the only variables, and a side is capped at the
 * document's own. It does not travel through `composedContext`, so it does not eat the 600
 * characters that one is held to; it does share the 77-token window those exist to protect.
 */
export const PIXEL_ART_PROMPT_MAX = 90

/**
 * The written prompt with the grid said after it. 🛑 Idempotent, and that is not a nicety: the
 * catalogue keeps what was WRITTEN, and from the main's side that already includes these words —
 * the window put them there before the IPC. A regeneration would double them, then triple them,
 * and nothing would go red. It also spares whoever typed them from reading them twice.
 */
export function withPixelArtPrompt(written: string, columns: number, rows: number): string {
  if (/pixel art/i.test(written)) return written

  const words = pixelArtWords(columns, rows)
  return written.trim().length === 0 ? words : `${written}, ${words}`
}
