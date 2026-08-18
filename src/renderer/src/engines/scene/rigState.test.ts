import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  VectorKeyframeTrack,
} from 'three'
import { describe, expect, it } from 'vitest'
import { rigStateOf, skeletonBonesOf } from './rigState'

function boneNamed(name: string): Bone {
  const bone = new Bone()
  bone.name = name
  return bone
}

/** A chain of bones, each the child of the one before it. */
function chain(names: readonly string[]): Bone[] {
  const bones = names.map(boneNamed)
  bones.forEach((bone, index) => {
    if (index > 0) bones[index - 1]?.add(bone)
  })
  return bones
}

function skinnedOn(bones: Bone[]): SkinnedMesh {
  const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial())
  mesh.add(bones[0] ?? boneNamed('root'))
  mesh.bind(new Skeleton(bones))
  return mesh
}

function rootWith(...children: Object3D[]): Object3D {
  const root = new Object3D()
  for (const child of children) root.add(child)
  return root
}

const walk = new AnimationClip('NlaTrack', 1, [
  new VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1, 0, 0]),
])

describe('what a loaded model is', () => {
  it('calls a mesh with no bones at all a static mesh', () => {
    const root = rootWith(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))

    expect(rigStateOf(root).status).toBe('staticMesh')
  })

  it('calls bones driving a mesh under unrecognised names a skinned mesh', () => {
    const root = rootWith(skinnedOn(chain(['Root', 'L_Thigh', 'L_Calf'])))

    expect(rigStateOf(root).status).toBe('skinnedMesh')
  })

  it('calls bones filling humanoid roles a rigged character', () => {
    const root = rootWith(skinnedOn(chain(['Hips', 'Spine', 'Head'])))

    expect(rigStateOf(root).status).toBe('riggedCharacter')
  })

  it('calls a rigged character carrying clips an animated character', () => {
    const root = rootWith(skinnedOn(chain(['Hips', 'Spine', 'Head'])))

    expect(rigStateOf(root, [walk]).status).toBe('animatedCharacter')
  })

  it('calls bones with no skinned mesh a skeleton only, whatever they are named', () => {
    const root = rootWith(...chain(['Hips', 'Spine', 'Head']).slice(0, 1))

    expect(rigStateOf(root, [walk]).status).toBe('skeletonOnly')
  })

  it('reads the mixamo prefix off a name before matching a role', () => {
    const root = rootWith(skinnedOn(chain(['mixamorig:Hips', 'mixamorig:Spine'])))

    expect(rigStateOf(root).status).toBe('riggedCharacter')
  })

  /**
   * Some export pipelines strip joint names. Such a character cannot be keyed by hand — nothing
   * can address a nameless bone — but it is not a bare mesh either, and telling its owner it
   * « cannot be animated yet » would be false.
   */
  it('does not call a skinned rig static just because its joints lost their names', () => {
    const nameless = [new Bone(), new Bone()]
    nameless[0]?.add(nameless[1] ?? new Bone())
    const state = rigStateOf(rootWith(skinnedOn(nameless)))

    expect(state.status).toBe('skinnedMesh')
    expect(state.boneCount).toBe(2)
    expect(state.bones).toEqual([])
  })
})

describe('the bones of a model', () => {
  it('gives each one the nearest bone above it', () => {
    const root = rootWith(skinnedOn(chain(['Hips', 'Spine', 'Head'])))

    expect(skeletonBonesOf(root).map(bone => [bone.name, bone.parent])).toEqual([
      ['Hips', null],
      ['Spine', 'Hips'],
      ['Head', 'Spine'],
    ])
  })

  it('skips the objects between two bones when naming a parent', () => {
    const hips = boneNamed('Hips')
    const holder = new Object3D()
    const head = boneNamed('Head')
    holder.add(head)
    hips.add(holder)

    expect(skeletonBonesOf(rootWith(hips))).toContainEqual({
      name: 'Head',
      parent: 'Hips',
      role: 'Head',
    })
  })

  it('leaves out a bone the file did not name', () => {
    const hips = boneNamed('Hips')
    hips.add(new Bone())

    expect(skeletonBonesOf(rootWith(hips))).toHaveLength(1)
  })

  it('keeps one bone per name, since nothing downstream can address the second', () => {
    const first = boneNamed('Hips')
    first.add(boneNamed('Hips'))

    expect(skeletonBonesOf(rootWith(first))).toHaveLength(1)
  })

  it('labels a bone with the role its name spells, and leaves the others bare', () => {
    const root = rootWith(...chain(['Hips', 'L_ThighTwist01']).slice(0, 1))

    expect(skeletonBonesOf(root).map(bone => bone.role)).toEqual(['Hips', undefined])
  })
})
