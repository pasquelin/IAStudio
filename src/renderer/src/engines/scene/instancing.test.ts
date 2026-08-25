import { BoxGeometry, InstancedMesh, Mesh, MeshStandardMaterial, Object3D } from 'three'
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

const host = () => new Object3D()

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

  it('skips a hidden node, which nothing should draw at all', () => {
    const scene = host()
    const { nodes, objects } = alike(WORTH_INSTANCING)
    const hidden = nodes.map(node => ({ ...node, visible: false }))

    expect(createInstancedGroups(scene).rebuild(hidden, id => objects.get(id))).toBe(0)
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
