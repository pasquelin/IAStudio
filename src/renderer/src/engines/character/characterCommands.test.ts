import { describe, expect, it } from 'vitest'
import type { Rig } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import {
  addCharacterBone,
  addCharacterIkChain,
  addCharacterSocket,
  linkCharacterMotion,
  removeCharacterBone,
  removeCharacterIkChain,
  removeCharacterSocket,
  renameCharacterBone,
  setCharacterBoneRole,
  setCharacterRig,
  unlinkCharacterMotion,
} from './characterCommands'
import { EMPTY_CHARACTER, type CharacterState } from './characterState'

const RIG: Rig = {
  origin: 'imported',
  bones: [
    { name: 'Hips', parent: null, rest: IDENTITY_TRANSFORM, role: 'Hips' },
    { name: 'LeftUpperLeg', parent: 'Hips', rest: IDENTITY_TRANSFORM },
    { name: 'LeftLowerLeg', parent: 'LeftUpperLeg', rest: IDENTITY_TRANSFORM },
    { name: 'LeftFoot', parent: 'LeftLowerLeg', rest: IDENTITY_TRANSFORM },
  ],
}

const RIGGED: CharacterState = { ...EMPTY_CHARACTER, assetId: 'asset-1', rig: RIG }

const SOCKET = { id: 's1', name: 'Paume droite', bone: 'LeftFoot', rest: IDENTITY_TRANSFORM }

describe('editing a character', () => {
  it('undoes what it did, which is the whole reason a rig is a document', () => {
    const command = removeCharacterBone('LeftFoot')
    const after = command.apply(RIGGED)

    expect(after.rig?.bones).toHaveLength(3)
    expect(command.revert(after)).toEqual(RIGGED)
  })

  it('hangs a bone taken out on the one above, rather than taking its children with it', () => {
    const after = removeCharacterBone('LeftLowerLeg').apply(RIGGED)

    expect(after.rig?.bones.find(one => one.name === 'LeftFoot')?.parent).toBe('LeftUpperLeg')
  })

  // A rig the reader would drop on the next open is never written: `rigFaultOf` is the one judge.
  it('refuses a name another bone already answers to', () => {
    const command = renameCharacterBone('LeftFoot', 'Hips')

    expect(command.refuses?.(RIGGED)).toBe(true)
    expect(command.apply(RIGGED)).toEqual(RIGGED)
  })

  it('takes a role from whichever bone held it, a rig holding one twice being unreadable', () => {
    const after = setCharacterBoneRole('LeftFoot', 'Hips').apply(RIGGED)

    expect(after.rig?.bones.find(one => one.name === 'Hips')?.role).toBeUndefined()
    expect(after.rig?.bones.find(one => one.name === 'LeftFoot')?.role).toBe('Hips')
  })

  it('names a child after its parent, so a document reads the same in either language', () => {
    const after = addCharacterBone('LeftFoot').apply(RIGGED)

    expect(after.rig?.bones.at(-1)?.name).toBe('LeftFoot.1')
  })

  // The handle is a bone one pulls: three's solver reaches for bones and knows nothing else.
  it('gives a chain its handle, and takes the handle back with the chain', () => {
    const added = addCharacterIkChain('LeftFoot').apply(RIGGED)
    expect(added.rig?.bones.some(one => one.name === 'LeftFoot.handle')).toBe(true)
    expect(added.rig?.ik).toHaveLength(1)

    const removed = removeCharacterIkChain('LeftFoot.handle').apply(added)
    expect(removed.rig?.bones.some(one => one.name === 'LeftFoot.handle')).toBe(false)
    expect(removed.rig?.ik).toEqual([])
  })

  it('refuses a chain on a bone this rig has not got', () => {
    expect(addCharacterIkChain('Tail').refuses?.(RIGGED)).toBe(true)
  })

  it('refuses a point of attachment on a bone nothing can follow', () => {
    expect(addCharacterSocket({ ...SOCKET, bone: 'Tail' }).refuses?.(RIGGED)).toBe(true)
  })

  it('refuses a second point of attachment answering to the same name', () => {
    const one = addCharacterSocket(SOCKET).apply(RIGGED)

    expect(addCharacterSocket({ ...SOCKET, id: 's2' }).refuses?.(one)).toBe(true)
    expect(removeCharacterSocket('s1').apply(one).sockets).toEqual([])
  })

  // A motion is a FILE: forgetting it here leaves it where it is, for the next character.
  it('links a motion once, and forgets it without taking the file with it', () => {
    const motion = { id: 'm1', name: 'Capoeira', assetId: 'asset-9' }
    const linked = linkCharacterMotion(motion).apply(RIGGED)

    expect(linked.motions).toEqual([motion])
    expect(linkCharacterMotion({ ...motion, id: 'm2' }).refuses?.(linked)).toBe(true)
    expect(unlinkCharacterMotion('m1').apply(linked).motions).toEqual([])
  })

  it('closes the band on a motion it no longer knows', () => {
    const open = { ...RIGGED, motions: [{ id: 'm1', name: 'x', assetId: 'a' }], editing: 'm1' }

    expect(unlinkCharacterMotion('m1').apply(open).editing).toBeNull()
  })

  it('puts a skeleton on a character that had none, and takes it back off', () => {
    const command = setCharacterRig(RIG)
    const after = command.apply({ ...EMPTY_CHARACTER, assetId: 'asset-1' })

    expect(after.rig).toBe(RIG)
    expect(command.revert(after).rig).toBeNull()
  })
})
