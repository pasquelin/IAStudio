import { PropertyBinding } from 'three'
import { describe, expect, it } from 'vitest'
import { HUMANOID_BODY_ROLES, type HumanoidRole } from '@shared/domain/humanoid'
import { boneRolesOf, type NamedBone } from './boneRoles'
import { TRIPO_BONES, UTHANA_MOTION_BONES, UTHANA_RIG_BONES } from './boneRoles-fixtures'

function chain(...names: string[]): NamedBone[] {
  return names.map((name, index) => ({
    name,
    parent: index === 0 ? null : (names[index - 1] ?? null),
  }))
}

describe('reading the measured provider skeletons', () => {
  it('gives all twenty-two Uthana bones a role', () => {
    const roles = boneRolesOf(UTHANA_RIG_BONES)

    expect(UTHANA_RIG_BONES.filter(bone => !roles[bone.name])).toEqual([])
    expect(new Set(Object.values(roles))).toEqual(new Set(HUMANOID_BODY_ROLES))
  })

  it('gives all fifty-two Uthana motion bones a role, fingers included', () => {
    const roles = boneRolesOf(UTHANA_MOTION_BONES)

    expect(UTHANA_MOTION_BONES.filter(bone => !roles[bone.name])).toEqual([])
    expect(roles['mixamorig:LeftHandThumb1']).toBe('LeftThumb1')
    // Mixamo's fifth finger is the studio's `Little` — the glTF and VRM spelling.
    expect(roles['mixamorig:RightHandPinky3']).toBe('RightLittle3')
  })

  it('reads Tripo down to the wrists and leaves every twist bone alone', () => {
    const roles = boneRolesOf(TRIPO_BONES)
    const twists = TRIPO_BONES.filter(bone => /Twist\d+$/.test(bone.name))

    expect(twists).toHaveLength(18)
    // `NeckTwist01` is the exception, and it is the whole point of reading the tree.
    expect(twists.filter(bone => roles[bone.name]).map(bone => bone.name)).toEqual(['NeckTwist01'])
    expect(roles.L_Thigh).toBe('LeftUpperLeg')
    expect(roles.L_Calf).toBe('LeftLowerLeg')
    expect(roles.L_Clavicle).toBe('LeftShoulder')
    expect(roles.R_Upperarm).toBe('RightUpperArm')
    expect(roles.R_Forearm).toBe('RightLowerArm')
    expect(roles.Waist).toBe('Spine')
    expect(roles.Spine01).toBe('Chest')
    expect(roles.Spine02).toBe('UpperChest')
  })

  it('hands Tripo its hips to the bone the legs and the trunk share', () => {
    const roles = boneRolesOf(TRIPO_BONES)

    expect(roles.Hip).toBe('Hips')
    // Both are synonyms of the hips; only the higher one may hold the role, and `Root` is above
    // the body rather than part of it.
    expect(roles.Pelvis).toBeUndefined()
    expect(roles.Root).toBeUndefined()
  })

  it('leaves a role unfilled when the file has no such bone', () => {
    const roles = boneRolesOf(TRIPO_BONES)

    // The positive half matters: without it this passes on an empty answer.
    expect(Object.values(roles)).toContain('LeftFoot')
    expect(Object.values(roles)).not.toContain('LeftToes')
  })
})

describe('the same file spelled two ways', () => {
  /**
   * A skeleton as three holds it. `GLTFLoader` runs every node name through
   * `sanitizeNodeName`, which DELETES the reserved characters rather than replacing them, so
   * `mixamorig:Hips` reaches the scene as `mixamorigHips` — measured on the real file on
   * 2026-08-18. The fixtures above are the FILE's spelling, which a parser reading a GLB without
   * loading it sees; both must answer, or a rig is recognised in one screen and not the other.
   */
  function asThreeHoldsIt(bones: readonly NamedBone[]): NamedBone[] {
    return bones.map(bone => ({
      name: PropertyBinding.sanitizeNodeName(bone.name),
      parent: bone.parent === null ? null : PropertyBinding.sanitizeNodeName(bone.parent),
    }))
  }

  it('reads the loaded skeleton exactly as it reads the file', () => {
    const fromFile = boneRolesOf(UTHANA_MOTION_BONES)
    const loaded = boneRolesOf(asThreeHoldsIt(UTHANA_MOTION_BONES))

    // KEY BY KEY, not just the roles: comparing the values alone would pass even if every role
    // had landed on a different bone, which is the one thing this is here to catch.
    expect(loaded).toEqual(
      Object.fromEntries(
        Object.entries(fromFile).map(([name, role]) => [
          PropertyBinding.sanitizeNodeName(name),
          role,
        ]),
      ),
    )
    expect(loaded.mixamorigHips).toBe('Hips')
  })
})

describe('the naming conventions', () => {
  it('reads a Biped skeleton', () => {
    const roles = boneRolesOf(chain('Bip001 Pelvis', 'Bip001 Spine', 'Bip001 L Thigh'))

    expect(roles['Bip001 Pelvis']).toBe('Hips')
    expect(roles['Bip001 Spine']).toBe('Spine')
    expect(roles['Bip001 L Thigh']).toBe('LeftUpperLeg')
  })

  it('reads a single-letter side only when what follows is a part it knows', () => {
    const roles = boneRolesOf(chain('R_Foot', 'Leg', 'Ribcage'))

    expect(roles.R_Foot).toBe('RightFoot')
    // `Leg` and `Ribcage` both open on a side letter, and neither remainder names anything.
    expect(roles.Leg).toBeUndefined()
    expect(roles.Ribcage).toBeUndefined()
  })

  it('drops any namespace, whichever one a file uses', () => {
    const roles = boneRolesOf(chain('mixamorig1:Hips', 'rig:Spine'))

    expect(roles['mixamorig1:Hips']).toBe('Hips')
    expect(roles['rig:Spine']).toBe('Spine')
  })

  it('drops a second armature’s namespace once the colon has been deleted', () => {
    // What a file spelling `mixamorig1:Hips` becomes once loaded — a case none of the three
    // measured files carries, closed for consistency with the line above rather than by measure.
    expect(boneRolesOf(chain('mixamorig1Hips'))['mixamorig1Hips']).toBe('Hips')
  })
})

describe('naming the neck off the tree', () => {
  it('keeps the neck a rig spelled itself', () => {
    const roles = boneRolesOf(chain('Hips', 'Spine', 'Neck', 'Head'))

    expect(roles.Neck).toBe('Neck')
  })

  it('leaves a head hanging under nothing without inventing one', () => {
    const roles = boneRolesOf(chain('Floater', 'Head'))

    expect(roles.Head).toBe('Head')
    expect(roles.Floater).toBeUndefined()
  })

  it('names no neck when the head sits straight on the trunk', () => {
    const roles = boneRolesOf(chain('Hips', 'Spine', 'Head'))

    expect(Object.values(roles)).toEqual(['Hips', 'Spine', 'Head'])
  })
})

describe('what a broken file gets', () => {
  it('answers on bones whose parents loop', () => {
    const looping: NamedBone[] = [
      { name: 'Hips', parent: 'Head' },
      { name: 'Head', parent: 'Hips' },
    ]

    expect(boneRolesOf(looping)).toEqual<Record<string, HumanoidRole>>({
      Hips: 'Hips',
      Head: 'Head',
    })
  })

  it('answers nothing on a skeleton that fills no role', () => {
    expect(boneRolesOf(chain('wheel', 'axle', 'chassis'))).toEqual({})
  })
})
