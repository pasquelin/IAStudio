import { clamp } from '@shared/numeric'
import { copyTransform, sameVector3, type Transform } from '@shared/domain/transform'
import type { CameraView, EntityPlacement, RenderPort } from '@game/ports/renderPort'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import type { RuntimePerformance } from '@shared/domain/gameRuntime'

/**
 * The one thing a running game asks of the viewport. Narrowed to it rather than taking the whole
 * engine: a test then drives this without a WebGL context, and nothing here can reach for the
 * rest of a 4 300-line class by accident.
 */
export type SceneDraw = Pick<
  SceneRenderer,
  'apply' | 'placeView' | 'releaseView' | 'viewPlacement'
> & {
  runtimePerformance?: () => Omit<RuntimePerformance, 'cpuFrameMs' | 'compilationMs'>
}

/**
 * What draws a running game inside the studio: the scene the editor already has, redrawn from a
 * SHADOW state the document knows nothing about.
 *
 * The nodes a step did not move are handed over BY IDENTITY, and `SceneRenderer.apply` skips a
 * node it has already applied.
 *
 * 🛑 That is not the whole cost, and saying so would be a comfortable lie: `apply` is the engine's
 * FULL pass — every node walked twice, poses laid, shadows re-cut, instances regrouped — so one
 * moving platform in a large scene pays all of it. Since the poses are INTERPOLATED it is paid at
 * the rate of the SCREEN, not of the step: 120 a second on a fast display, not 60. A
 * `SceneRenderer` of its own for Play is what fixes that, and it is not this lot.
 *
 * 🛑 It never writes to the store. That is the whole of why STOP restores nothing: one `apply` of
 * the untouched edit state puts the viewport back where it was.
 */
export function createStudioRender(
  renderer: SceneDraw,
  editState: () => SceneState,
  /** Told how far the picture is veiled, for a host that has something to veil it with. */
  onVeil: (amount: number) => void = () => {},
): RenderPort {
  const shadow = new Map<string, SceneNode>()
  const watched: CameraView = { position: NOWHERE, target: NOWHERE }
  let byId = new Map<string, SceneNode>()
  let bakedById = new Map<string, string>()
  let source: SceneState | null = null
  let veiled = 0

  return {
    place: (placements: readonly EntityPlacement[]) => {
      const state = editState()
      let changed = false

      if (state !== source) {
        // 🛑 The document changed under a running game — a click on a node is one, the selection
        // being part of the state — and the viewport has just applied it OVER what the game had
        // drawn. The shadow is rebuilt on the new nodes, keeping where the game had put them, and
        // repainted at once: without that a PAUSED game snaps back to the authored pose and stays
        // there, since nothing moves to trigger a redraw.
        source = state
        byId = new Map(state.nodes.map(node => [node.id, node]))
        bakedById = new Map(
          state.nodes.flatMap(node =>
            node.type === 'mesh' && node.instances
              ? node.instances.map(instance => [instance.sourceId, node.id])
              : [],
          ),
        )
        for (const [id, held] of shadow) {
          const fresh = byId.get(id)
          if (fresh) shadow.set(id, { ...fresh, transform: held.transform })
          else shadow.delete(id)
        }
        changed = shadow.size > 0
      }

      for (let index = 0; index < placements.length; index++) {
        const placement = placements[index]
        if (!placement) continue

        const bakedId = bakedById.get(placement.entity)
        const node = byId.get(bakedId ?? placement.entity)
        if (!node) continue

        if (bakedId && node.type === 'mesh' && node.instances) {
          const shown = shadow.get(bakedId) ?? node
          if (shown.type !== 'mesh' || !shown.instances) continue
          const instance = shown.instances.find(one => one.sourceId === placement.entity)
          if (!instance || sameTransform(instance.transform, placement.transform)) continue
          shadow.set(bakedId, {
            ...shown,
            instances: shown.instances.map(one =>
              one.sourceId === placement.entity
                ? { ...one, transform: copyTransform(placement.transform) }
                : one,
            ),
          })
          changed = true
          continue
        }

        const shown = shadow.get(placement.entity) ?? node
        if (sameTransform(shown.transform, placement.transform)) continue

        shadow.set(placement.entity, { ...node, transform: copyTransform(placement.transform) })
        changed = true
      }

      // Nothing rebuilt while nothing moves: a paused game, or one whose systems are all idle,
      // costs the comparison above and not one allocation.
      if (changed) {
        renderer.apply({ ...state, nodes: state.nodes.map(node => shadow.get(node.id) ?? node) })
      }
    },

    // Nothing means `orbit`: the scene is flown by hand, and a camera written every frame would
    // fight whoever is dragging it. A view that has not MOVED is dropped too — `placeView` asks
    // for a frame, so a character standing still would repaint the viewport sixty times a second.
    view: (wanted: CameraView | null) => {
      if (!wanted || sameView(watched, wanted)) return
      watched.position = { ...wanted.position }
      watched.target = { ...wanted.target }
      renderer.placeView(wanted)
    },

    /**
     * 🛑 Written on the SESSION rather than into the document: a veil is how a game is being
     * watched at this instant, and one written into the scene would put an undo entry per frame
     * of a fade — the very reason the playhead is not in the document either.
     */
    veil: amount => {
      const wanted = clamp(amount, 0, 1)
      if (wanted === veiled) return
      veiled = wanted
      onVeil(wanted)
    },
  }
}

/** Off the scene, so the first view a game asks for is never mistaken for the one already held. */
const NOWHERE = { x: Number.NaN, y: Number.NaN, z: Number.NaN }

const sameView = (one: CameraView, other: CameraView): boolean =>
  sameVector3(one.position, other.position) && sameVector3(one.target, other.target)

const sameTransform = (one: Transform, other: Transform): boolean =>
  one.position.x === other.position.x &&
  one.position.y === other.position.y &&
  one.position.z === other.position.z &&
  one.rotation.x === other.rotation.x &&
  one.rotation.y === other.rotation.y &&
  one.rotation.z === other.rotation.z &&
  one.scale.x === other.scale.x &&
  one.scale.y === other.scale.y &&
  one.scale.z === other.scale.z
