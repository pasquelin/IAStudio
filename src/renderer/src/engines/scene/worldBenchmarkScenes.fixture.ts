import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { DEFAULT_WORLD, type LightDescriptor } from '@shared/domain/scene'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { newComponent } from '@shared/domain/componentRegistry'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  shadowDefaults,
  type MeshNode,
  type SceneNode,
  type SceneState,
} from './sceneState'

export type WorldBenchmarkId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

export type WorldBenchmarkScene = {
  id: WorldBenchmarkId
  purpose: string
  state: SceneState
}

const SUN: LightDescriptor = {
  kind: 'directional',
  color: '#ffffff',
  intensity: 1,
  target: { x: 0, y: 0, z: 0 },
}

function meshNode(id: string): MeshNode {
  return {
    id,
    parentId: null,
    name: id,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'mesh' }),
    type: 'mesh',
    geometry: { kind: 'box', width: 1, height: 1, depth: 1 },
    material: DEFAULT_MATERIAL,
  }
}

function positioned(node: MeshNode, index: number, width: number): MeshNode {
  return {
    ...node,
    transform: {
      ...IDENTITY_TRANSFORM,
      position: { x: index % width, y: 0, z: Math.floor(index / width) },
    },
  }
}

function state(nodes: readonly SceneNode[]): SceneState {
  return { nodes, selectedIds: [], world: DEFAULT_WORLD, animation: EMPTY_TIMELINE }
}

export function worldBenchmarkScenes(): readonly WorldBenchmarkScene[] {
  return [
    benchmark('S1', 'small-world overhead', repeatedMeshes('small', 50, 10)),
    benchmark('S2', 'repeated-object instancing', repeatedMeshes('tree', 10_000, 100)),
    benchmark('S3', 'different static props batching', batchedProps()),
    benchmark('S4', 'city partitioning and culling', repeatedMeshes('building', 20_000, 200)),
    mixedBenchmark(),
  ]
}

function repeatedMeshes(prefix: string, length: number, width: number): MeshNode[] {
  return Array.from({ length }, (_unused, index) =>
    positioned(meshNode(`${prefix}-${index}`), index, width),
  )
}

function batchedProps(): MeshNode[] {
  return Array.from({ length: 10_000 }, (_unused, index): MeshNode => {
    const node = positioned(meshNode(`prop-${index}`), index, 100)
    return {
      ...node,
      geometry: { kind: 'box', width: 1 + index / 100_000, height: 1, depth: 1 },
      optimization: { mode: 'batch' },
    }
  })
}

function mixedNodes(): SceneNode[] {
  return [
    ...validationNodes(),
    ...Array.from({ length: 300 }, (_unused, index) =>
      positioned(meshNode(`static-${index}`), index, 30),
    ),
    { ...meshNode('animated'), components: [newComponent('Spin')] },
    {
      ...meshNode('physical'),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 5, z: 0 } },
      components: [newComponent('Collider'), newComponent('RigidBody')],
    },
    {
      ...meshNode('scripted'),
      components: [{ ...newComponent('Script'), script: 'script:Benchmark.ts' }],
    },
    {
      id: 'character',
      parentId: null,
      name: 'Character',
      visible: true,
      transform: IDENTITY_TRANSFORM,
      ...shadowDefaults({ type: 'model' }),
      type: 'model',
      model: { assetId: 'character.glb' },
    },
    {
      id: 'particles',
      parentId: null,
      name: 'Particles',
      visible: true,
      transform: IDENTITY_TRANSFORM,
      ...shadowDefaults({ type: 'sprite' }),
      type: 'sprite',
      sprite: { ...DEFAULT_SPRITE, map: { assetId: 'particles.png' } },
    },
    {
      id: 'sun',
      parentId: null,
      name: 'Sun',
      visible: true,
      transform: IDENTITY_TRANSFORM,
      ...shadowDefaults({ type: 'light', light: SUN }),
      type: 'light',
      light: SUN,
    },
  ]
}

function validationNodes(): SceneNode[] {
  return [
    {
      id: 'validation-group',
      parentId: null,
      name: 'Validation group',
      visible: true,
      transform: IDENTITY_TRANSFORM,
      ...shadowDefaults({ type: 'group' }),
      type: 'group',
    },
    {
      ...meshNode('validation-child'),
      parentId: 'validation-group',
      instances: [
        {
          sourceId: 'validation-instance',
          name: 'Validation instance',
          transform: IDENTITY_TRANSFORM,
        },
      ],
    },
  ]
}

function mixedBenchmark(): WorldBenchmarkScene {
  return {
    id: 'S5',
    purpose: 'mixed gameplay compatibility',
    state: {
      ...state(mixedNodes()),
      world: { ...DEFAULT_WORLD, play: { ...DEFAULT_WORLD.play, gravity: 9.81 } },
      animation: {
        ...EMPTY_TIMELINE,
        events: [{ id: 'benchmark-event', at: 0, name: 'BenchmarkStarted' }],
        transitions: [
          { id: 'benchmark-cut', at: 0, kind: 'cut', duration: 0, scene: 'BenchmarkNext' },
        ],
      },
    },
  }
}

function benchmark(
  id: WorldBenchmarkId,
  purpose: string,
  nodes: readonly SceneNode[],
): WorldBenchmarkScene {
  return { id, purpose, state: state(nodes) }
}
