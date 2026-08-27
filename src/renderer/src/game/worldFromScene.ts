import { COMPONENTS } from '@shared/domain/componentRegistry'
import { copyTransform, IDENTITY_TRANSFORM, type Transform } from '@shared/domain/transform'
import type { GameApi } from '@game/api/gameApi'
import type { BodyDescriptor } from '@game/ports/physicsPort'
import { createCharacters } from '@game/runtime/characters'
import type { Entity } from '@game/runtime/entity'
import { STEP_SECONDS } from '@game/runtime/gameLoop'
import { createMovementSystem } from '@game/runtime/systems/movement'
import { createPhysicsSystem } from '@game/runtime/systems/physics'
import { createPlayCameraSystem } from '@game/runtime/systems/playCamera'
import { createScriptSystem, type ScriptSystemOptions } from '@game/runtime/systems/script'
import { createTimelineSystem } from '@game/runtime/systems/timeline'
import { createWorld, type System, type World } from '@game/runtime/world'
import type { ColliderShape } from '@game/physics/shape'
import type { SceneState } from '@/engines/scene/sceneState'
import { colliderFromNode } from './colliderFromNode'
import { createHierarchy } from './hierarchy'

/**
 * The scene's own floor is not a node, so it is not an entity either — and a game whose ground
 * nobody stands on is the first thing anyone tries. A dot keeps the name out of reach of a uuid.
 */
const GROUND_BODY = 'world.ground'

/** Deep enough that nothing falls through it in one step at terminal speed. */
const GROUND_DEPTH = 5

/**
 * The edit state, translated into something that runs.
 *
 * 🛑 A COPY, down to each vector: the world writes positions in place, and sharing the document's
 * own objects would let a step edit the scene the user is editing. Nothing here holds a reference
 * back to the store either — that absence is what makes STOP restore nothing.
 *
 * In the window rather than under `src/game`: `SceneState` is the studio's, and the runtime may
 * not import it. An exported game reads its `.gltf` instead, the same translation from the other
 * side.
 */
export function worldFromScene(
  documentId: string,
  state: SceneState,
  ports: GameApi,
  scripts: Partial<ScriptSystemOptions> = {},
  seed = 1,
): World {
  const told: ScriptSystemOptions = {
    modules: scripts.modules ?? [],
    // 🛑 The game's own log rather than nothing: without a studio listening, a fault that goes
    // nowhere is a script that silently never ran — and a caller passing an empty one is how
    // that happened in the exported game.
    onFault:
      scripts.onFault ??
      (fault => ports.log.write('error', `${fault.script}:${fault.line} — ${fault.message}`)),
  }
  const world = createWorld({
    scene: { kind: 'document', id: documentId },
    ports,
    systems: systemsFor(state, ports, told),
    seed,
    step: STEP_SECONDS,
    play: state.world.play,
  })

  for (const node of state.nodes) {
    world.entities.add({
      id: node.id,
      name: node.name,
      transform: copyTransform(node.transform),
      // 🛑 Deep, not a spread: a shallow copy leaves the DOCUMENT'S own component objects in the
      // world, and a system writing into one would edit the scene being edited — with no store
      // action, so `isSceneDirty` stays false and a ⌘S saves it. Safe because a component is pure
      // JSON by contract.
      components: structuredClone([...(node.components ?? [])]),
    })
  }

  return world
}

/** Every system the studio runs today. A component gains its behaviour by joining this list. */
function systemsFor(
  state: SceneState,
  ports: GameApi,
  scripts: ScriptSystemOptions,
): readonly System[] {
  const byId = new Map(state.nodes.map(node => [node.id, node]))
  const hierarchy = createHierarchy(byId)
  const placed = (entity: Entity): Transform => hierarchy.worldOf(entity.id, entity.transform)
  const characters = createCharacters()

  /**
   * 🛑 A node hanging from another is FELT now, and that closed the hole this carried since the
   * physics arrived: the body goes in at its composed place — see `hierarchy` — and what the step
   * moves is written back into the frame the node hangs in.
   *
   * What stays true: the SHAPE is the node's own, so a scaled parent stretches the mesh and not
   * the collider. Named here rather than discovered.
   */
  const shapeOf = (entity: Entity): ColliderShape | null => {
    const node = byId.get(entity.id)
    if (!node) return null

    const collider = colliderFromNode(node)
    if (!collider) {
      ports.log.write('warn', `${node.name} has no shape the physics can feel`)
      return null
    }
    // Said rather than swallowed: a pierced wall whose fidelity could not be honoured collides as
    // a solid one, and nothing on screen would tell an author why the window stopped them.
    if (!collider.exact) {
      ports.log.write('warn', `${node.name} collides as a hull: its fidelity could not be met`)
    }
    return collider.shape
  }

  return [
    createScriptSystem(scripts),
    // 🛑 Where it runs is decided by `SYSTEM_ORDER`, not by this list — and a row is heard one
    // step LATE whatever the order: `emit` queues, and the bus drains at the end of a step.
    createTimelineSystem({
      timeline: state.animation,
      assetRef: id => ({ kind: 'asset', id }),
    }),
    createMovementSystem(),
    createPhysicsSystem({
      shapeOf,
      characters,
      statics: groundOf(state),
      worldOf: placed,
      localOf: (entity, position, rotation) => hierarchy.localOf(entity.id, position, rotation),
    }),
    createPlayCameraSystem(characters, placed),
  ]
}

/** The scene's ground as a slab, its top face at zero — where the studio draws it. */
function groundOf(state: SceneState): readonly BodyDescriptor[] {
  const ground = state.world.ground
  if (!ground.visible) return []

  return [
    {
      body: GROUND_BODY,
      kind: 'fixed',
      shape: {
        kind: 'cuboid',
        hx: ground.size / 2,
        hy: GROUND_DEPTH / 2,
        hz: ground.size / 2,
        at: { x: 0, y: -GROUND_DEPTH / 2, z: 0 },
      },
      transform: IDENTITY_TRANSFORM,
      friction: Number(COMPONENTS.Collider.defaults.friction),
      restitution: Number(COMPONENTS.Collider.defaults.restitution),
      mass: 0,
      gravityScale: 1,
      lockRotation: false,
      sensor: false,
      character: null,
    },
  ]
}
