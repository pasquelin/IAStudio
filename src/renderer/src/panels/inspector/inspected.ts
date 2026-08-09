import type { Selection } from '@/stores/selection'

/**
 * Which texture the inspector is showing the material of, or `null` when it is showing anything
 * else.
 *
 * Extracted rather than asked twice: the inspector's title row carries a button that only means
 * something on the material face, and a second answer to "which face is drawn" would be free to
 * disagree with the first — a button offering to save a material while a video clip is on screen.
 * `Face` reads this too, so there is one answer.
 *
 * Two things take the face away from the document in front. A selection made in a panel speaks
 * louder — a clicked layer or clip is what one is looking at — and a scene in front wins over a
 * texture, which is the reading order `Face` has always had.
 */
export function inspectedTextureId(
  selection: Selection,
  sceneId: string | null,
  textureId: string | null,
): string | null {
  if (selection.kind !== 'none') return null
  if (sceneId) return null
  return textureId
}
