import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { WORTH_INSTANCING } from './grouping'
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
    expect(plan.estimated).toEqual({
      drawCallsBefore: WORTH_INSTANCING,
      drawCallsAfter: 1,
    })
    expect([...objects.values()].map(mesh => mesh.visible)).toEqual(visibility)
    expect(optimizationReport(plan)).toMatchObject({
      instanceCandidates: WORTH_INSTANCING,
      visualChanges: 'NONE',
    })
  })

  it('returns the same ordered plan for the same world', () => {
    const { nodes, objects } = repeated(WORTH_INSTANCING)
    const analyze = () =>
      analyzeOptimization({ nodes, animation: EMPTY_TIMELINE }, new Object3D(), id =>
        objects.get(id),
      )

    expect(analyze()).toEqual(analyze())
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
    expect(plan.measured).toMatchObject({ objects: 2, meshes: 2, geometryBytes: expectedBytes })
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
