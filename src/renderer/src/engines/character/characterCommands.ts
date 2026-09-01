import type { Command } from '../core/history'
import type { CharacterSocket, MotionRef } from '@shared/domain/character'
import { socketsFaultOf } from '@shared/domain/character'
import type { HumanoidRole } from '@shared/domain/humanoid'
import {
  childBone,
  IK_HANDLE,
  rigFaultOf,
  rigRenamed,
  rigWithBones,
  rigWithoutBone,
  rigWithRole,
  type IkChain,
  type Rig,
  type RigBone,
} from '@shared/domain/rig'
import { rigHandBones } from '../scene/rigFit'
import { ikLinksOf } from './ik'
import type { CharacterState } from './characterState'

/**
 * What one does to a character's own file: its skeleton, its points of attachment, the motions
 * it knows.
 *
 * `engines/scene/commands.ts`'s rig half, carried onto the window's own state. No node id in
 * front of any of them — the window edits one character, and a parameter that always holds the
 * same value is one that lies.
 */

/**
 * One whole-state edit, undone by putting back what it replaced.
 *
 * The state is small and flat — one character — so keeping the previous one costs nothing where
 * a scene's sweep has to remember node by node. `null` refuses, and a refusal is not a step.
 */
function edit(
  id: string,
  next: (state: CharacterState) => CharacterState | null,
): Command<CharacterState> {
  let previous: CharacterState | null = null

  return {
    id,
    apply: state => {
      const written = next(state)
      if (!written) return state

      previous = state
      return written
    },
    revert: state => previous ?? state,
    refuses: state => next(state) === null,
  }
}

export function setCharacterRig(rig: Rig | null): Command<CharacterState> {
  return edit('rig', state => ({ ...state, rig }))
}

/** Every bone edit goes through this: a rig the reader would drop is never written. */
function editBones(
  id: string,
  change: (bones: readonly RigBone[]) => readonly RigBone[] | null,
): Command<CharacterState> {
  return edit(id, state => {
    const next = state.rig && change(state.rig.bones)
    if (!state.rig || !next || rigFaultOf(next) !== null) return null

    return { ...state, rig: { ...state.rig, bones: next } }
  })
}

export function addCharacterBone(parent: string): Command<CharacterState> {
  return editBones('bone.add', bones => rigWithBones(bones, [childBone(bones, parent)]))
}

export function removeCharacterBone(name: string): Command<CharacterState> {
  return editBones('bone.remove', bones => rigWithoutBone(bones, name))
}

export function renameCharacterBone(from: string, to: string): Command<CharacterState> {
  return editBones('bone.rename', bones => rigRenamed(bones, from, to))
}

export function setCharacterBoneRole(
  name: string,
  role: HumanoidRole | null,
): Command<CharacterState> {
  return editBones('bone.role', bones => rigWithRole(bones, name, role))
}

/** The thirty joints inside the hands a fit stops at the wrists. */
export function addCharacterHands(): Command<CharacterState> {
  return editBones('rig.hands', bones => {
    const hands = rigHandBones(bones)
    return hands && rigWithBones(bones, hands)
  })
}

/**
 * A chain that reaches, and the handle one pulls it by — ONE command, because a chain naming a
 * bone the rig has not got is a chain the reader drops.
 */
export function addCharacterIkChain(effector: string): Command<CharacterState> {
  return edit('ik.add', state => {
    const rig = state.rig
    if (!rig || !rig.bones.some(bone => bone.name === effector)) return null

    const target = `${effector}${IK_HANDLE}`
    if (rig.bones.some(bone => bone.name === target)) return null

    const held = rig.bones.find(bone => bone.name === effector)
    const bones = rigWithBones(rig.bones, [
      { name: target, parent: held?.parent ?? null, rest: held?.rest ?? IDENTITY_REST },
    ])
    if (!bones) return null

    const chain: IkChain = { id: target, effector, target, links: ikLinksOf(rig.bones, effector) }
    return { ...state, rig: { ...rig, bones, ik: [...(rig.ik ?? []), chain] } }
  })
}

export function removeCharacterIkChain(chainId: string): Command<CharacterState> {
  return edit('ik.remove', state => {
    const rig = state.rig
    const chain = rig?.ik?.find(one => one.id === chainId)
    if (!rig || !chain) return null

    return {
      ...state,
      rig: {
        ...rig,
        bones: rigWithoutBone(rig.bones, chain.target),
        ik: rig.ik?.filter(one => one.id !== chainId) ?? [],
      },
    }
  })
}

export function addCharacterSocket(socket: CharacterSocket): Command<CharacterState> {
  return edit('socket.add', state => {
    // Refused rather than written: a point on a bone nobody has is one nothing can ever follow.
    if (!state.rig?.bones.some(bone => bone.name === socket.bone)) return null

    const sockets = [...state.sockets, socket]
    return socketsFaultOf(sockets) === null ? { ...state, sockets } : null
  })
}

export function removeCharacterSocket(id: string): Command<CharacterState> {
  return edit('socket.remove', state =>
    state.sockets.some(one => one.id === id)
      ? { ...state, sockets: state.sockets.filter(one => one.id !== id) }
      : null,
  )
}

/** A motion this character learns to play — a reference to a file, never a copy of one. */
export function linkCharacterMotion(motion: MotionRef): Command<CharacterState> {
  return edit('motion.link', state =>
    state.motions.some(one => one.assetId === motion.assetId)
      ? null
      : { ...state, motions: [...state.motions, motion] },
  )
}

/** Forgotten by this character. The FILE stays where it is: another character may play it. */
export function unlinkCharacterMotion(id: string): Command<CharacterState> {
  return edit('motion.unlink', state =>
    state.motions.some(one => one.id === id)
      ? { ...state, motions: state.motions.filter(one => one.id !== id) }
      : null,
  )
}

const IDENTITY_REST = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
}
