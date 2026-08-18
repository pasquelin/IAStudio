import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import type { Rig } from '@shared/domain/rig'
import { INFLUENCES } from './skinMessage'
import { emptyBinding } from './skinVertices'
import { applyRig, bonesOfRig, positionsIn, skinnableMeshesOf } from './rigBuild'

const REST = (x: number, y: number, z: number) => ({
  position: { x, y, z },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
})

const RIG: Rig = {
  origin: 'local',
  bones: [
    { name: 'Hips', parent: null, rest: REST(0, 1, 0), role: 'Hips' },
    { name: 'Spine', parent: 'Hips', rest: REST(0, 0.2, 0), role: 'Spine' },
    { name: 'Head', parent: 'Spine', rest: REST(0, 0.4, 0), role: 'Head' },
  ],
}

function modelWith(...meshes: Object3D[]): Group {
  const holder = new Group()
  for (const mesh of meshes) holder.add(mesh)
  return holder
}

const plainMesh = () => new Mesh(new BoxGeometry(), new MeshStandardMaterial())

const bindingFor = (mesh: Mesh) => emptyBinding(mesh.geometry.getAttribute('position').count)

describe('the bones a rig becomes', () => {
  it('parents them the way the rig spells it', () => {
    const { bones } = bonesOfRig(RIG)
    const spine = bones.find(bone => bone.name === 'Spine')

    expect(spine?.parent?.name).toBe('Hips')
  })

  it('hands back the roots apart, since they are what hangs on the model', () => {
    expect(bonesOfRig(RIG).roots.map(bone => bone.name)).toEqual(['Hips'])
  })

  // The weights index into this order: shuffling it would have every vertex follow another bone.
  it('keeps the rig own order, which is the order the weights index into', () => {
    expect(bonesOfRig(RIG).bones.map(bone => bone.name)).toEqual(['Hips', 'Spine', 'Head'])
  })

  it('rests each bone where the rig put it, in its parent space', () => {
    const spine = bonesOfRig(RIG).bones.find(bone => bone.name === 'Spine')

    expect(spine?.position.y).toBeCloseTo(0.2, 6)
  })
})

describe('which meshes can be bound', () => {
  it('finds the plain ones', () => {
    expect(skinnableMeshesOf(modelWith(plainMesh(), plainMesh()))).toHaveLength(2)
  })

  // A file that already carries a rig is left to the rigger that made it — rebinding it would
  // throw away weights someone painted.
  it('leaves an already skinned mesh alone', () => {
    const skinned = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial())

    expect(skinnableMeshesOf(modelWith(skinned))).toEqual([])
  })
})

describe('reading a mesh positions in its holder space', () => {
  // The bones are fitted to the holder's bounding box while a mesh inside a GLB carries a
  // transform of its own: measuring in the wrong one lands the whole rig beside the body.
  it('carries the mesh own transform into the numbers', () => {
    const mesh = plainMesh()
    mesh.position.set(10, 0, 0)
    const positions = positionsIn(mesh, modelWith(mesh))

    expect(positions[0]).toBeCloseTo(10.5, 5)
  })

  it('answers three floats per vertex', () => {
    const mesh = plainMesh()
    const count = mesh.geometry.getAttribute('position').count

    expect(positionsIn(mesh, modelWith(mesh))).toHaveLength(count * 3)
  })
})

describe('putting a rig on a model', () => {
  it('replaces the plain mesh by a skinned one bound to the bones', () => {
    const mesh = plainMesh()
    const holder = modelWith(mesh)

    applyRig(holder, RIG, [bindingFor(mesh)])

    const skinned = skinnedIn(holder)
    expect(skinned).not.toBeNull()
    expect(skinned?.skeleton.bones.map(bone => bone.name)).toEqual(['Hips', 'Spine', 'Head'])
  })

  it('hangs the bones on the model, so they move with it', () => {
    const mesh = plainMesh()
    const holder = modelWith(mesh)

    applyRig(holder, RIG, [bindingFor(mesh)])

    expect(holder.children.some(child => child.name === 'Hips')).toBe(true)
  })

  it('writes four influences per vertex onto the geometry', () => {
    const mesh = plainMesh()
    const holder = modelWith(mesh)
    const count = mesh.geometry.getAttribute('position').count

    applyRig(holder, RIG, [bindingFor(mesh)])

    const skinned = skinnedIn(holder)
    expect(skinned?.geometry.getAttribute('skinIndex').count).toBe(count)
    expect(skinned?.geometry.getAttribute('skinWeight').itemSize).toBe(INFLUENCES)
  })

  it('keeps the mesh where it stood, and what it was called', () => {
    const mesh = plainMesh()
    mesh.name = 'body'
    mesh.position.set(1, 2, 3)

    const holder = modelWith(mesh)
    applyRig(holder, RIG, [bindingFor(mesh)])

    const skinned = skinnedIn(holder)
    expect(skinned?.name).toBe('body')
    expect(skinned?.position.toArray()).toEqual([1, 2, 3])
  })

  it('leaves a model with nothing to bind untouched', () => {
    const holder = modelWith(new Object3D())

    applyRig(holder, RIG, [])

    expect(holder.children.some(child => child.name === 'Hips')).toBe(false)
  })
})

function skinnedIn(holder: Object3D): SkinnedMesh | null {
  let found: SkinnedMesh | null = null
  holder.traverse(object => {
    if (object instanceof SkinnedMesh) found = object
  })
  return found
}
