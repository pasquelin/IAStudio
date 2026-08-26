/**
 * What the composer holds of one effect, and what every effect is handed on each frame.
 *
 * Deliberately not a `Pass`: an effect may be several passes (a separable blur), none of its own
 * (anything fused), or one of three.js's own. What they have in common is that they are BUILT
 * once and WRITTEN every frame, and this type is where that split is stated.
 */
import type { Camera, Scene } from 'three'
import type { Pass } from 'three/addons/postprocessing/Pass.js'
import type { PostParamValue } from '@shared/domain/postProcessing'
import type { PostBudget } from './postQuality'

export type EffectParams = Readonly<Record<string, PostParamValue>>

/** What THIS draw is: the scene and the lens it is drawn through, at the size it is drawn. */
export type ViewInfo = {
  scene: Scene
  camera: Camera
  /** The size of the pass chain, in pixels — already divided by the budget. */
  width: number
  height: number
  /** Seconds. What grain and tape jitter advance on; never a frame count. */
  time: number
  budget: PostBudget
}

export type EffectInstance = {
  /** Empty for a fused effect: its arithmetic lives inside a pass it shares with its neighbours. */
  passes: readonly Pass[]
  /**
   * Moves the parameters into the uniforms. Called once per draw, and it must NEVER rebuild:
   * that promise is the whole of § 20, and `stackShapeKey` is what keeps it keepable.
   */
  apply: (params: EffectParams, view: ViewInfo) => void
  setSize: (width: number, height: number) => void
  dispose: () => void
}
