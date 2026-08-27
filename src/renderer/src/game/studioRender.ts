import type { Transform, Vector3 } from '@shared/domain/transform'
import type { CameraView, EntityPlacement, RenderPort } from '@game/ports/renderPort'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'

/**
 * The one thing a running game asks of the viewport. Narrowed to it rather than taking the whole
 * engine: a test then drives this without a WebGL context, and nothing here can reach for the
 * rest of a 4 300-line class by accident.
 */
export type SceneDraw = Pick<SceneRenderer, 'apply' | 'placeView' | 'viewPlacement'>

/**
 * What draws a running game inside the studio: the scene the editor already has, redrawn from a
 * SHADOW state the document knows nothing about.
 *
 * The nodes a step did not move are handed over BY IDENTITY, and `SceneRenderer.apply` skips a
 * node it has already applied.
 *
 * 🛑 That is not the whole cost, and saying so would be a comfortable lie: `apply` is the engine's
 * FULL pass — every node walked twice, poses laid, shadows re-cut, instances regrouped — so one
 * moving platform in a large scene pays all of it, sixty times a second. A `SceneRenderer` of its
 * own for Play is what fixes that, and it is not this lot.
 *
 * 🛑 It never writes to the store. That is the whole of why STOP restores nothing: one `apply` of
 * the untouched edit state puts the viewport back where it was.
 */
export function createStudioRender(renderer: SceneDraw, editState: () => SceneState): RenderPort {
  const shadow = new Map<string, SceneNode>()
  const watched: CameraView = { position: NOWHERE, target: NOWHERE }
  let byId = new Map<string, SceneNode>()
  let source: SceneState | null = null

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

        const node = byId.get(placement.entity)
        if (!node) continue

        const shown = shadow.get(placement.entity) ?? node
        if (sameTransform(shown.transform, placement.transform)) continue

        shadow.set(placement.entity, { ...node, transform: copyOf(placement.transform) })
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
  }
}

/** Off the scene, so the first view a game asks for is never mistaken for the one already held. */
const NOWHERE = { x: Number.NaN, y: Number.NaN, z: Number.NaN }

const sameView = (one: CameraView, other: CameraView): boolean =>
  samePoint(one.position, other.position) && samePoint(one.target, other.target)

const samePoint = (one: Vector3, other: Vector3): boolean =>
  one.x === other.x && one.y === other.y && one.z === other.z

const copyOf = (transform: Transform): Transform => ({
  position: { ...transform.position },
  rotation: { ...transform.rotation },
  scale: { ...transform.scale },
})

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
