import { describe, expect, it } from 'vitest'
import { isRig, rigFaultOf, type RigBone } from './rig'

const REST = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
}

function bone(name: string, parent: string | null, role?: RigBone['role']): RigBone {
  return { name, parent, rest: REST, ...(role ? { role } : {}) }
}

const SPINE: RigBone[] = [bone('Hips', null, 'Hips'), bone('Spine', 'Hips', 'Spine')]

describe('what makes a rig holdable', () => {
  it('accepts a chain whose every parent is one of its own bones', () => {
    expect(rigFaultOf(SPINE)).toBeNull()
  })

  it('refuses a rig with no bone in it', () => {
    expect(rigFaultOf([])).toBe('empty')
  })

  it('refuses two bones of the same name, which nothing could tell apart', () => {
    expect(rigFaultOf([bone('Hips', null), bone('Hips', null)])).toBe('duplicate-bone')
  })

  it('refuses a parent no bone answers to', () => {
    expect(rigFaultOf([bone('Spine', 'Hips')])).toBe('unknown-parent')
  })

  it('refuses a cycle rather than walking it forever', () => {
    expect(rigFaultOf([bone('Hips', 'Spine'), bone('Spine', 'Hips')])).toBe('cycle')
  })

  it('refuses a cycle that no bone of the rig points into', () => {
    const fault = rigFaultOf([bone('Hips', null), bone('A', 'B'), bone('B', 'A')])

    expect(fault).toBe('cycle')
  })

  it('refuses the same humanoid role on two bones', () => {
    const bones = [bone('Hips', null, 'Hips'), bone('Pelvis', 'Hips', 'Hips')]

    expect(rigFaultOf(bones)).toBe('duplicate-role')
  })

  it('lets two bones share no role at all', () => {
    expect(rigFaultOf([bone('Hips', null), bone('Spine', 'Hips')])).toBeNull()
  })
})

describe('reading a rig off a document', () => {
  it('accepts one a save wrote', () => {
    expect(isRig({ bones: SPINE, origin: 'local' })).toBe(true)
  })

  it('accepts a rig a provider produced, named', () => {
    const origin = { provider: 'uthana', modelId: 'model_uthana-character-rigging' }

    expect(isRig({ bones: SPINE, origin })).toBe(true)
  })

  it('refuses one whose bones break an invariant', () => {
    expect(isRig({ bones: [bone('Spine', 'Hips')], origin: 'local' })).toBe(false)
  })

  it('refuses a bone missing its rest pose', () => {
    expect(isRig({ bones: [{ name: 'Hips', parent: null }], origin: 'local' })).toBe(false)
  })

  it('refuses a role the standard does not hold', () => {
    const bones = [{ name: 'Hips', parent: null, rest: REST, role: 'Tail' }]

    expect(isRig({ bones, origin: 'local' })).toBe(false)
  })

  it('refuses one with no origin at all', () => {
    expect(isRig({ bones: SPINE })).toBe(false)
  })
})
