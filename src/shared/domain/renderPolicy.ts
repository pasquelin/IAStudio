import type { ShadowQuality, ViewportQuality } from './scene'

/**
 * What one image COSTS, read by BOTH engines that draw the same scene — the editor's viewport and
 * an exported game.
 *
 * Carried by an export so a game shows what its author saw. The two decided it apart until now,
 * and nothing compared them: the editor drew every shadow at a size its quality level capped,
 * while an exported game drew none at all and paid the screen's whole pixel ratio.
 */
export type RenderPolicy = {
  shadows: boolean
  shadowQuality: ShadowQuality
  /** Side of the square map each casting light allocates, before the quality level caps it. */
  shadowMapSize: number
  /** How finely the frame is drawn — it moves `pixelRatio` and caps the shadow maps. */
  quality: ViewportQuality
}

/**
 * What an export written before this existed means, and what a game plays under when nobody said.
 * The viewport's own defaults, so the two sides open on the same picture.
 */
export const DEFAULT_RENDER_POLICY: RenderPolicy = Object.freeze({
  shadows: true,
  shadowQuality: 'soft',
  shadowMapSize: 2048,
  quality: 'balanced',
})

/**
 * The four values, taken off the larger object a viewport reads: an export carries these and not
 * the twenty settings that only mean something in front of an editor.
 */
export function renderPolicyOf(view: RenderPolicy): RenderPolicy {
  return {
    shadows: view.shadows,
    shadowQuality: view.shadowQuality,
    shadowMapSize: view.shadowMapSize,
    quality: view.quality,
  }
}
