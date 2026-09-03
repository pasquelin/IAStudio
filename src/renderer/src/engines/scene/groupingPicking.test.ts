import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { WORTH_INSTANCING } from './grouping'
import { createBatchedGroups } from './batching'
import { createCellGroups } from './cellInstancing'
import { createInstancedGroups } from './instancing'
import { meshNode } from './scene-fixtures'
import type { SceneNode } from './sceneState'

/** One shape and one paint, spaced so a ray straight down meets exactly one of them. */
function alike(count: number): { nodes: SceneNode[]; objects: Map<string, Mesh> } {
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial()
  const nodes: SceneNode[] = []
  const objects = new Map<string, Mesh>()
  for (let at = 0; at < count; at += 1) {
    const node = meshNode(`n${at}`)
    const mesh = new Mesh(geometry, material)
    mesh.position.set(at * 2, 0, 0)
    mesh.updateMatrixWorld(true)
    nodes.push(node)
    objects.set(node.id, mesh)
  }
  return { nodes, objects }
}

// A source held out of the walk is out of the ray's targets too, so a strategy that draws for a
// body owes the click its name. One of the three answered `null` and only a click would have said.
describe.each([
  ['cells', createCellGroups],
  ['batched', createBatchedGroups],
  ['instanced', createInstancedGroups],
])('%s: what a click meets once the sources are held out', (_strategy, group) => {
  it('names the node behind every body it draws for', () => {
    const scene = new Object3D()
    const groups = group(scene)
    const { nodes, objects } = alike(WORTH_INSTANCING)
    groups.rebuild(nodes, id => objects.get(id))
    scene.updateMatrixWorld(true)

    const targets = [...groups.pickable()]
    const held = [...objects].filter(([, mesh]) => groups.holdsSource(mesh))
    expect(held.length).toBe(WORTH_INSTANCING)

    for (const [id, mesh] of held) {
      const from = new Vector3(mesh.position.x, 10, mesh.position.z)
      const hit = new Raycaster(from, new Vector3(0, -1, 0)).intersectObjects(targets, false)[0]
      expect(hit && groups.nodeIdOf(hit)).toBe(id)
    }
  })
})
