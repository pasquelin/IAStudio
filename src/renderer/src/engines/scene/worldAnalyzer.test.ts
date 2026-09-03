import {
  BoxGeometry,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  Texture,
} from 'three'
import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { DRAWN_BY_INSTANCE, WORTH_INSTANCING } from './grouping'
import { groupNodeFixture, meshNode } from './scene-fixtures'
import type { SceneNode } from './sceneState'
import { analyzeOptimization, optimizationReport } from './worldAnalyzer'

function repeated(count: number): {
  nodes: ReturnType<typeof meshNode>[]
  objects: Map<string, Mesh>
} {
  const geometry = new BoxGeometry()
  const material = new MeshStandardMaterial()
  const nodes = Array.from({ length: count }, (_unused, index) => meshNode(`node-${index}`))
  return {
    nodes,
    objects: new Map(nodes.map(node => [node.id, new Mesh(geometry, material)])),
  }
}

describe('analyzeOptimization', () => {
  it('reports repeated static meshes without changing their render state', () => {
    const { nodes, objects } = repeated(WORTH_INSTANCING)
    const visibility = [...objects.values()].map(mesh => mesh.visible)

    const plan = analyzeOptimization({ nodes, animation: EMPTY_TIMELINE }, new Object3D(), id =>
      objects.get(id),
    )

    expect(plan.instances).toHaveLength(1)
    expect(plan.instances[0]?.sourceIds).toHaveLength(WORTH_INSTANCING)
    const geometry = objects.values().next().value?.geometry
    if (!geometry) throw new Error('fixture has no geometry')
    const geometryBytes = Object.values(geometry.attributes).reduce(
      (bytes, attribute) => bytes + attribute.array.byteLength,
      geometry.index?.array.byteLength ?? 0,
    )
    expect(plan.estimated).toEqual({
      drawCallsBefore: WORTH_INSTANCING,
      drawCallsAfter: 1,
      avoidedGeometryBytes: geometryBytes * (WORTH_INSTANCING - 1),
      avoidedTextureBytes: 0,
    })
    expect([...objects.values()].map(mesh => mesh.visible)).toEqual(visibility)
    expect(optimizationReport(plan)).toMatchObject({
      instanceCandidates: WORTH_INSTANCING,
      visualChanges: 'NONE',
    })
  })

  /**
   * 🛑 `sweep` parks a source it has already instanced on `DRAWN_BY_INSTANCE` and leaves it
   * VISIBLE. Counted as a draw call, the analysis re-proposed a group the engine had made.
   */
  it('still reports the authoring sources after the runtime has instanced them', () => {
    const { nodes, objects } = repeated(WORTH_INSTANCING)
    for (const mesh of objects.values()) mesh.layers.set(DRAWN_BY_INSTANCE)

    const plan = analyzeOptimization({ nodes, animation: EMPTY_TIMELINE }, new Object3D(), id =>
      objects.get(id),
    )

    expect(plan.instances).toHaveLength(1)
    expect(plan.measured.meshes).toBe(WORTH_INSTANCING)
    expect(plan.estimated.drawCallsBefore).toBe(WORTH_INSTANCING)
  })

  it('does not promise groups below a scripted parent the runtime must preserve', () => {
    const { nodes, objects } = repeated(WORTH_INSTANCING)
    const parent: SceneNode = {
      ...groupNodeFixture('parent'),
      components: [{ type: 'Script' }],
    }
    const children: SceneNode[] = nodes.map(node => ({ ...node, parentId: parent.id }))

    const plan = analyzeOptimization(
      { nodes: [parent, ...children], animation: EMPTY_TIMELINE },
      new Object3D(),
      id => objects.get(id),
    )

    expect(plan.instances).toEqual([])
    expect(plan.estimated.drawCallsAfter).toBe(plan.estimated.drawCallsBefore)
  })

  it('keeps a selected child excluded when its scripted parent is outside the report target', () => {
    const { nodes, objects } = repeated(WORTH_INSTANCING)
    const parent: SceneNode = {
      ...groupNodeFixture('parent'),
      components: [{ type: 'Script' }],
    }
    const children: SceneNode[] = nodes.map(node => ({ ...node, parentId: parent.id }))

    const plan = analyzeOptimization(
      { nodes: children, animation: EMPTY_TIMELINE },
      new Object3D(),
      id => objects.get(id),
      undefined,
      [parent, ...children],
    )

    expect(plan.instances).toEqual([])
  })

  it('returns the same ordered plan for the same world', () => {
    const { nodes, objects } = repeated(WORTH_INSTANCING)
    const analyze = () =>
      analyzeOptimization({ nodes, animation: EMPTY_TIMELINE }, new Object3D(), id =>
        objects.get(id),
      )

    expect(analyze()).toEqual(analyze())
  })

  it('reports compatible different shapes as batch candidates before Force Batch is applied', () => {
    const first: SceneNode = { ...meshNode('first'), optimization: { mode: 'exclude' } }
    const second: SceneNode = {
      ...meshNode('second'),
      geometry: { kind: 'box', width: 2, height: 1, depth: 1 },
      optimization: { mode: 'individual' },
    }
    const material = new MeshStandardMaterial()
    const objects = new Map<string, Mesh>([
      [first.id, new Mesh(new BoxGeometry(), material)],
      [second.id, new Mesh(new BoxGeometry(2, 1, 1), material)],
    ])

    const plan = analyzeOptimization(
      { nodes: [first, second], animation: EMPTY_TIMELINE },
      new Object3D(),
      id => objects.get(id),
    )

    expect(plan.instances).toEqual([])
    expect(plan.batches).toHaveLength(1)
    expect(plan.batches[0]?.sourceIds).toEqual(['first', 'second'])
  })

  it('classifies moving, animated, and skinned objects as unsafe candidates', () => {
    const moving: SceneNode = { ...meshNode('moving'), components: [{ type: 'Movement' }] }
    const animated = meshNode('animated')
    const skinned = meshNode('skinned')
    const objects = new Map<string, Object3D>([
      [moving.id, new Mesh(new BoxGeometry(), new MeshStandardMaterial())],
      [animated.id, new Mesh(new BoxGeometry(), new MeshStandardMaterial())],
      [skinned.id, new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial())],
    ])
    const animation: AnimationTimeline = {
      ...EMPTY_TIMELINE,
      tracks: [
        {
          id: 'track',
          name: 'Move',
          index: 0,
          muted: false,
          solo: false,
          locked: false,
          target: { nodeId: animated.id, property: 'position' },
          keys: [],
        },
      ],
    }

    const plan = analyzeOptimization(
      { nodes: [moving, animated, skinned], animation },
      new Object3D(),
      id => objects.get(id),
      { minInstancesPerGroup: 1 },
    )

    expect(plan.instances).toEqual([])
    expect(plan.warnings).toEqual([
      { nodeId: 'moving', reason: 'dynamic' },
      { nodeId: 'animated', reason: 'animated' },
      { nodeId: 'skinned', reason: 'skinned' },
    ])
  })

  it('measures shared geometry once while counting every visible mesh', () => {
    const { nodes, objects } = repeated(2)
    const geometry = objects.get(nodes[0]?.id ?? '')?.geometry
    if (!geometry) throw new Error('fixture has no geometry')

    const plan = analyzeOptimization({ nodes, animation: EMPTY_TIMELINE }, new Object3D(), id =>
      objects.get(id),
    )

    const expectedBytes = Object.values(geometry.attributes).reduce(
      (bytes, attribute) => bytes + attribute.array.byteLength,
      geometry.index?.array.byteLength ?? 0,
    )
    expect(plan.measured).toMatchObject({
      objects: 2,
      meshes: 2,
      geometryBytes: expectedBytes,
      sharedMaterials: 1,
    })
    expect(plan.estimated.avoidedGeometryBytes).toBe(expectedBytes)
  })

  it('counts an interleaved geometry buffer once when estimating avoided memory', () => {
    const geometry = new BufferGeometry()
    const interleaved = new InterleavedBuffer(new Float32Array(18), 6)
    geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0))
    geometry.setAttribute('normal', new InterleavedBufferAttribute(interleaved, 3, 3))
    const material = new MeshStandardMaterial()
    const first = meshNode('first')
    const second = meshNode('second')
    const objects = new Map<string, Mesh>([
      [first.id, new Mesh(geometry, material)],
      [second.id, new Mesh(geometry, material)],
    ])

    const plan = analyzeOptimization(
      { nodes: [first, second], animation: EMPTY_TIMELINE },
      new Object3D(),
      id => objects.get(id),
    )

    expect(plan.estimated.avoidedGeometryBytes).toBe(interleaved.array.byteLength)
  })

  it('measures memory already avoided by shared textures', () => {
    const texture = new Texture({ width: 16, height: 8 })
    const firstMaterial = new MeshStandardMaterial({ map: texture })
    const secondMaterial = new MeshStandardMaterial({ map: texture })
    const first = meshNode('first')
    const second = meshNode('second')
    const objects = new Map<string, Mesh>([
      [first.id, new Mesh(new BoxGeometry(), firstMaterial)],
      [second.id, new Mesh(new BoxGeometry(), secondMaterial)],
    ])

    const plan = analyzeOptimization(
      { nodes: [first, second], animation: EMPTY_TIMELINE },
      new Object3D(),
      id => objects.get(id),
    )

    expect(plan.estimated.avoidedTextureBytes).toBe(16 * 8 * 4)
    expect(plan.measured.sharedMaterials).toBe(0)
  })

  it('counts a parented mesh once and leaves hidden branches out of measured render costs', () => {
    const host = new Object3D()
    const group = new Object3D()
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    const groupNode = groupNodeFixture('group')
    const childNode = meshNode('child', groupNode.id)
    group.visible = false
    group.add(mesh)
    host.add(group)
    const objects = new Map<string, Object3D>([
      [groupNode.id, group],
      [childNode.id, mesh],
    ])

    const plan = analyzeOptimization(
      { nodes: [groupNode, childNode], animation: EMPTY_TIMELINE },
      host,
      id => objects.get(id),
    )

    expect(plan.measured).toMatchObject({ objects: 2, meshes: 0, draws: 0, geometryBytes: 0 })
    expect(plan.classifications[0]).toEqual({ id: 'group', classifications: ['STATIC'] })
  })

  it('keeps a hidden skinned mesh unsafe', () => {
    const node = meshNode('skinned')
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial())
    mesh.visible = false

    const plan = analyzeOptimization(
      { nodes: [node], animation: EMPTY_TIMELINE },
      new Object3D(),
      () => mesh,
      { minInstancesPerGroup: 1 },
    )

    expect(plan.classifications[0]?.classifications).toEqual(['SKINNED', 'UNSAFE'])
    expect(plan.instances).toEqual([])
  })
})
