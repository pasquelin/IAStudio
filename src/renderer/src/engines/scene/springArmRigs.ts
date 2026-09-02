import type { Vector3 } from '@shared/domain/transform'
import { COMPONENT_DEFAULTS } from '@game/runtime/componentDefaults'
import { numberOf, textOf } from '@game/runtime/componentFields'
import { lookOf, aheadOf, type Look } from '@game/runtime/playView'
import { armPivot, armSeat } from '@game/runtime/systems/springArmRig'
import { restingAxes } from '@game/physics/quaternion'
import { withBoundPlayerArm } from './playerModule'
import type { SceneNode } from './sceneState'

const ARM = COMPONENT_DEFAULTS.SpringArm

/**
 * An arm as a viewport can draw it. OFFSETS and not world points, so the aid follows a dragged
 * module without being recomputed: `lift` reaches the body up to the pivot, `back` the pivot out
 * to the seat.
 */
export type ArmRig = { subjectId: string; lift: Vector3; back: Vector3 }

/** How a node is turned, in world — what only the scene graph can answer. */
export type ArmFacing = (id: string) => Vector3 | null

/**
 * Every arm's rest shape, keyed by the node carrying it. 🛑 Built off `withBoundPlayerArm`, so the
 * aid draws the arm the GAME will ride — a field naming `Capsule` resolves inside its own module,
 * past any namesake elsewhere. The look is the one the first frame of play takes.
 */
export function springArmRigsOf(
  nodes: readonly SceneNode[],
  facingOf: ArmFacing,
): ReadonlyMap<string, ArmRig> {
  const bound = withBoundPlayerArm(nodes)
  const found = new Map<string, ArmRig>()
  // The id first and the FIRST name after, exactly as `entityNamed` resolves one: an arm outside a
  // module keeps the name its author typed, and reading ids alone drew nothing for those.
  const held = new Map(bound.map(node => [node.id, node.id]))
  for (const node of bound) if (!held.has(node.name)) held.set(node.name, node.id)

  for (const node of bound) {
    const arm = node.components?.find(one => one.type === 'SpringArm')
    const subjectId = arm && held.get(textOf(arm, 'subject', ARM.subject))
    if (!arm || !subjectId) continue

    const orientation = textOf(arm, 'orientation', ARM.orientation)
    const turned =
      orientation === 'pointer' ? null : facingOf(orientation === 'subject' ? subjectId : node.id)
    const look = turned ? lookOf(turned, AXES, LOOK) : LEVEL

    const lift = armPivot(
      ORIGIN,
      numberOf(arm, 'height', ARM.height),
      numberOf(arm, 'shoulder', ARM.shoulder),
      look.yaw,
      { x: 0, y: 0, z: 0 },
    )
    const back = armSeat(ORIGIN, aheadOf(look, AHEAD), numberOf(arm, 'length', ARM.length), {
      x: 0,
      y: 0,
      z: 0,
    })
    found.set(node.id, { subjectId, lift, back })
  }
  return found
}

const AXES = restingAxes()
const LOOK: Look = { yaw: 0, pitch: 0 }
const LEVEL: Look = { yaw: 0, pitch: 0 }
const AHEAD: Vector3 = { x: 0, y: 0, z: 0 }
/** Both offsets are worked out from nothing, which is what makes them offsets. */
const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }
