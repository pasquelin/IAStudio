import {
  BoxGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { describe, expect, it } from 'vitest'
import { meshNode } from './scene-fixtures'
import { DRAWN_BY_INSTANCE, WORTH_INSTANCING, createInstancedGroups } from './instancing'
import type { SceneNode } from './sceneState'

/** One shape, N nodes of it — a decor someone copied and pasted, which is the case that costs. */
function alike(count: number): { nodes: SceneNode[]; objects: Map<string, Mesh> } {
  const nodes: SceneNode[] = []
  const objects = new Map<string, Mesh>()
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial()

  for (let at = 0; at < count; at += 1) {
    const node = meshNode(`n${at}`)
    const mesh = new Mesh(geometry, material)
    mesh.position.set(at, 0, 0)
    mesh.updateMatrixWorld(true)
    nodes.push(node)
    objects.set(node.id, mesh)
  }
  return { nodes, objects }
}

/** The same, of a shape dense enough to be worth splitting, spread over a level. */
function spread(count: number, over: number): { nodes: SceneNode[]; objects: Map<string, Mesh> } {
  const nodes: SceneNode[] = []
  const objects = new Map<string, Mesh>()
  const geometry = new IcosahedronGeometry(0.5, 2)
  const material = new MeshStandardMaterial()

  const side = Math.ceil(Math.sqrt(count))
  for (let at = 0; at < count; at += 1) {
    const node = meshNode(`n${at}`)
    const mesh = new Mesh(geometry, material)
    mesh.position.set(((at % side) * over) / side, 0, (Math.floor(at / side) * over) / side)
    mesh.updateMatrixWorld(true)
    nodes.push(node)
    objects.set(node.id, mesh)
  }
  return { nodes, objects }
}

/** Enough of a 320-triangle shape for the split to be worth several regions. */
const SPLIT_WORTHY = 2_000

const host = () => new Object3D()

const instancesIn = (scene: Object3D): InstancedMesh[] =>
  scene.children.filter(child => child instanceof InstancedMesh)

describe('createInstancedGroups', () => {
  it('leaves an ordinary scene alone, drawing nothing of its own', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING - 1)

    expect(createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))).toBe(0)
    expect(scene.children).toHaveLength(0)
    // Still the camera's layer: nothing else would draw them.
    expect([...objects.values()].every(mesh => mesh.layers.test(new Mesh().layers))).toBe(true)
  })

  it('draws a repeated shape through one instance', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING)
    const count = createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    expect(count).toBe(WORTH_INSTANCING)
    expect(scene.children).toHaveLength(1)
  })

  it('takes the meshes off the camera layer, and off it alone', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING)
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    // What keeps picking alive: they are still in the scene, matrices and all — just not drawn.
    for (const mesh of objects.values()) {
      expect(mesh.layers.isEnabled(DRAWN_BY_INSTANCE)).toBe(true)
      expect(mesh.layers.isEnabled(0)).toBe(false)
    }
  })

  it('places each instance where its mesh stands', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING)
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    const instance = scene.children[0]
    if (!(instance instanceof InstancedMesh)) throw new Error('no instance was built')
    // The third instance sits where the third mesh does — x = 2, as `alike` laid them out.
    expect(instance.instanceMatrix.array[2 * 16 + 12]).toBe(2)
  })

  it('separates two shapes that no single draw call could share', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING * 2)
    // Half of them become spheres: same count, two groups, and each still over the floor.
    for (const [at, node] of nodes.entries()) {
      if (at % 2 === 0 || node.type !== 'mesh') continue
      nodes[at] = {
        ...node,
        geometry: { kind: 'sphere', radius: 1, widthSegments: 8, heightSegments: 8 },
      }
    }
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    expect(scene.children).toHaveLength(2)
  })

  it('gives a shrunken group back to the camera, rather than leaving it invisible', () => {
    const scene = host()
    const groups = createInstancedGroups(scene)
    const { nodes, objects } = alike(WORTH_INSTANCING)
    groups.rebuild(nodes, id => objects.get(id))

    groups.rebuild(nodes.slice(0, 4), id => objects.get(id))
    for (const node of nodes.slice(0, 4)) {
      expect(objects.get(node.id)?.layers.isEnabled(0)).toBe(true)
    }
    expect(scene.children).toHaveLength(0)
  })

  it('skips a mesh the scene does not draw, whoever hid it', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING)
    for (const mesh of objects.values()) mesh.visible = false

    // Read off the object rather than the node: the viewport isolates on top of what the
    // document hides, and only the object carries both. Instanced, a hidden mesh comes back —
    // an `InstancedMesh` never consults the meshes it stands for.
    expect(createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))).toBe(0)
  })

  it('skips a mesh hanging from something hidden, which three.js would not draw either', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING)
    const branch = new Object3D()
    branch.visible = false
    scene.add(branch)
    for (const mesh of objects.values()) branch.add(mesh)

    expect(createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))).toBe(0)
  })

  it('takes its meshes away when the engine goes', () => {
    const scene = host()
    const groups = createInstancedGroups(scene)
    const { nodes, objects } = alike(WORTH_INSTANCING)
    groups.rebuild(nodes, id => objects.get(id))

    groups.dispose()
    expect(scene.children).toHaveLength(0)
  })
})

describe('splitting a group across the level it covers', () => {
  it('draws a spread-out shape through one instance per region', () => {
    const scene = host()
    const { nodes, objects } = spread(SPLIT_WORTHY, 600)
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    // One sphere for the whole level is one sphere the frustum can never say no to.
    expect(instancesIn(scene).length).toBeGreaterThan(1)
  })

  it('draws every mesh once across the regions, and none of them twice', () => {
    const scene = host()
    const { nodes, objects } = spread(SPLIT_WORTHY, 600)
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    const drawn = instancesIn(scene).reduce((all, instance) => all + instance.count, 0)
    expect(drawn).toBe(SPLIT_WORTHY)
  })

  it('gives each region bounds of its own, tight enough to be culled', () => {
    const scene = host()
    const { nodes, objects } = spread(SPLIT_WORTHY, 600)
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    // Bounds as wide as the level would pass every frustum test and cull nothing at all.
    for (const instance of instancesIn(scene)) {
      expect(instance.boundingSphere?.radius ?? Infinity).toBeLessThan(300)
    }
  })

  it('leaves a shape too cheap to split drawn in a single call', () => {
    const scene = host()
    // Cubes: twelve triangles, under the floor where the draw calls of a split earn it back.
    const { nodes, objects } = alike(SPLIT_WORTHY)
    createInstancedGroups(scene).rebuild(nodes, id => objects.get(id))

    expect(instancesIn(scene)).toHaveLength(1)
  })
})
