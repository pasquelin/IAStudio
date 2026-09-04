import {
  BatchedMesh,
  BoxGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { expect, it } from 'vitest'
import { meshNode } from './scene-fixtures'
import { createOptimizedGroups } from './optimizedGrouping'
import type { RuntimeRenderArtifact } from './grouping'
import type { SceneNode } from './sceneState'

it('draws automatic repetitions as instances and forced batches as BatchedMesh together', () => {
  const host = new Object3D()
  const material = new MeshStandardMaterial()
  const geometry = new BoxGeometry()
  const nodes: SceneNode[] = []
  const objects = new Map<string, Mesh>()

  for (let at = 0; at < 16; at += 1) {
    const node = meshNode(`instance-${at}`)
    nodes.push(node)
    objects.set(node.id, new Mesh(geometry, material))
  }
  for (let at = 0; at < 2; at += 1) {
    const node: SceneNode = {
      ...meshNode(`batch-${at}`),
      geometry: { kind: 'box', width: at + 2, height: 1, depth: 1 },
      optimization: { mode: 'batch' },
    }
    nodes.push(node)
    objects.set(node.id, new Mesh(new BoxGeometry(at + 2, 1, 1), material))
  }
  for (const object of objects.values()) object.updateMatrixWorld(true)

  const groups = createOptimizedGroups(host)
  expect(groups.rebuild(nodes, id => objects.get(id))).toBe(18)
  expect(groups.drawn().filter(mesh => mesh instanceof InstancedMesh)).not.toHaveLength(0)
  expect(groups.drawn().filter(mesh => mesh instanceof BatchedMesh)).toHaveLength(1)
})

it('keeps gameplay exclusions individual even when batch is forced', () => {
  const host = new Object3D()
  const node: SceneNode = { ...meshNode('door'), optimization: { mode: 'batch' } }
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  mesh.updateMatrixWorld(true)

  const groups = createOptimizedGroups(host)
  expect(groups.rebuild([node], () => mesh, new Set([node.id]))).toBe(0)
  expect(groups.drawn()).toHaveLength(0)
})

it('keeps individual and excluded overrides out of every optimized representation', () => {
  const host = new Object3D()
  const material = new MeshStandardMaterial()
  const nodes: SceneNode[] = [
    { ...meshNode('individual'), optimization: { mode: 'individual' } },
    { ...meshNode('excluded'), optimization: { mode: 'exclude' } },
  ]
  const objects = new Map(nodes.map(node => [node.id, new Mesh(new BoxGeometry(), material)]))
  for (const object of objects.values()) object.updateMatrixWorld(true)

  const groups = createOptimizedGroups(host)
  expect(groups.rebuild(nodes, id => objects.get(id))).toBe(0)
  expect(groups.drawn()).toHaveLength(0)
})

it('restores a grouped source when its override changes to individual', () => {
  const host = new Object3D()
  const material = new MeshStandardMaterial()
  const geometry = new BoxGeometry()
  const automatic = Array.from({ length: 16 }, (_unused, at) => meshNode(`node-${at}`))
  const objects = new Map(automatic.map(node => [node.id, new Mesh(geometry, material)]))
  for (const mesh of objects.values()) {
    host.add(mesh)
    mesh.updateMatrixWorld(true)
  }
  const groups = createOptimizedGroups(host)
  groups.rebuild(automatic, id => objects.get(id))
  const sources = new Set<Object3D>(objects.values())
  expect(host.children.every(child => !sources.has(child))).toBe(true)

  const individual: SceneNode[] = automatic.map(node => ({
    ...node,
    optimization: { mode: 'individual' },
  }))
  expect(groups.rebuild(individual, id => objects.get(id))).toBe(0)
  expect(groups.drawn()).toHaveLength(0)
  expect(host.children).toEqual([...objects.values()])
  expect([...objects.values()].every(mesh => mesh.layers.isEnabled(0))).toBe(true)
})

it('builds only the representations selected by compiled runtime artifacts', () => {
  const host = new Object3D()
  const material = new MeshStandardMaterial()
  const firstGeometry = new BoxGeometry()
  const secondGeometry = new BoxGeometry(2, 1, 1)
  const nodes = Array.from({ length: 32 }, (_unused, index) => meshNode(`node-${index}`))
  const objects = new Map(
    nodes.map((node, index) => [
      node.id,
      new Mesh(index < 16 ? firstGeometry : secondGeometry, material),
    ]),
  )
  for (const object of objects.values()) object.updateMatrixWorld(true)
  const artifacts: readonly RuntimeRenderArtifact[] = [
    {
      key: 'trees',
      strategy: 'instance',
      sourceIds: nodes.slice(0, 16).map(node => node.id),
      signature: 'compiled-trees',
    },
  ]

  const groups = createOptimizedGroups(host)

  expect(groups.rebuild(nodes, id => objects.get(id), undefined, artifacts)).toBe(16)
  expect(groups.drawn()).toHaveLength(1)
  expect(groups.drawn()[0]?.geometry).toBe(firstGeometry)
})

it('builds compiled merge and sub-instancing-threshold batch artifacts', () => {
  const host = new Object3D()
  const material = new MeshStandardMaterial()
  const nodes: SceneNode[] = Array.from({ length: 11 }, (_unused, index) => ({
    ...meshNode(`node-${index}`),
    geometry: { kind: 'box', width: index + 1, height: 1, depth: 1 },
  }))
  const objects = new Map(
    nodes.map((node, index) => [node.id, new Mesh(new BoxGeometry(index + 1, 1, 1), material)]),
  )
  for (const object of objects.values()) object.updateMatrixWorld(true)
  const artifacts: readonly RuntimeRenderArtifact[] = [
    {
      key: 'small-props',
      strategy: 'merge',
      sourceIds: nodes.slice(0, 2).map(node => node.id),
      signature: 'small-props',
    },
    {
      key: 'large-props',
      strategy: 'batch',
      sourceIds: nodes.slice(2).map(node => node.id),
      signature: 'large-props',
    },
  ]

  const groups = createOptimizedGroups(host)

  expect(groups.rebuild(nodes, id => objects.get(id), undefined, artifacts)).toBe(11)
  expect(
    groups.drawn().filter(mesh => mesh instanceof Mesh && !(mesh instanceof BatchedMesh)),
  ).toHaveLength(1)
  expect(groups.drawn().filter(mesh => mesh instanceof BatchedMesh)).toHaveLength(1)
})

it('rebuilds a merged group when a member moves beside a batched one', () => {
  const host = new Object3D()
  const material = new MeshStandardMaterial()
  const nodes: SceneNode[] = Array.from({ length: 11 }, (_unused, index) => ({
    ...meshNode(`node-${index}`),
    geometry: { kind: 'box', width: index + 1, height: 1, depth: 1 },
  }))
  const objects = new Map(
    nodes.map((node, index) => [node.id, new Mesh(new BoxGeometry(index + 1, 1, 1), material)]),
  )
  for (const object of objects.values()) {
    host.add(object)
    object.updateMatrixWorld(true)
  }
  const artifacts: readonly RuntimeRenderArtifact[] = [
    {
      key: 'small-props',
      strategy: 'merge',
      sourceIds: nodes.slice(0, 2).map(node => node.id),
      signature: 'small-props',
    },
    {
      key: 'large-props',
      strategy: 'batch',
      sourceIds: nodes.slice(2).map(node => node.id),
      signature: 'large-props',
    },
  ]
  const merged = (groups: ReturnType<typeof createOptimizedGroups>): Object3D | undefined =>
    groups.drawn().find(mesh => !(mesh instanceof BatchedMesh) && !(mesh instanceof InstancedMesh))

  const groups = createOptimizedGroups(host)
  groups.rebuild(nodes, id => objects.get(id), undefined, artifacts)
  const before = merged(groups)
  objects.get('node-0')?.position.set(50, 0, 0)
  objects.get('node-0')?.updateWorldMatrix(true, false)

  expect(groups.moved(['node-0', 'node-2'], id => objects.get(id))).toBe(true)
  expect(merged(groups)).not.toBe(before)
})
