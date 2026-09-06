import type { AnimationPort, PosedClip } from '@game/ports/animationPort'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'

/**
 * The three gestures a running game asks of the viewport's mixers. Narrowed as `SceneDraw` is:
 * a test drives this without a WebGL context, and nothing here can reach the rest of the class.
 */
export type SceneAnimate = Pick<SceneRenderer, 'poseNode' | 'releaseNode' | 'clipLengthsOf'>

/**
 * What poses a body from a state machine inside the studio.
 *
 * 🛑 It writes through the ONE mixer the viewport already holds for that model. A body posed this
 * way leaves the band for as long as it is posed — see `SceneAnimations.pose`.
 */
export function createStudioAnimation(renderer: SceneAnimate): {
  port: AnimationPort
  /**
   * Every body this posed, given back at once.
   *
   * 🛑 STOP does not dispose the world — it throws the engines away — so nothing would run the
   * animator's own `dispose`, and the character would keep the pose the last step left him in.
   */
  releaseAll: () => void
} {
  const posed = new Set<string>()

  return {
    port: {
      pose: (entity: string, clips: readonly PosedClip[]) => {
        posed.add(entity)
        renderer.poseNode(entity, clips)
      },
      release: (entity: string) => {
        posed.delete(entity)
        renderer.releaseNode(entity)
      },
      lengths: (entity: string) => renderer.clipLengthsOf(entity),
    },
    releaseAll: () => {
      for (const entity of posed) renderer.releaseNode(entity)
      posed.clear()
    },
  }
}
