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
  const small = Array.from({ length: 50 }, (_unused, index) =>
    positioned(meshNode(`small-${index}`), index, 10),
  )
  const repetition = Array.from({ length: 10_000 }, (_unused, index) =>
    positioned(meshNode(`tree-${index}`), index, 100),
  )
  const props = Array.from({ length: 10_000 }, (_unused, index): MeshNode => {
    const node = positioned(meshNode(`prop-${index}`), index, 100)
    return {
      ...node,
      geometry: { kind: 'box', width: 1 + index / 100_000, height: 1, depth: 1 },
      optimization: { mode: 'batch' },
    }
  })
  const city = Array.from({ length: 20_000 }, (_unused, index) =>
    positioned(meshNode(`building-${index}`), index, 200),
  )
  const mixed: SceneNode[] = [
    ...Array.from({ length: 300 }, (_unused, index) =>
      positioned(meshNode(`static-${index}`), index, 30),
    ),
    { ...meshNode('animated'), components: [newComponent('Spin')] },
    {
      ...meshNode('physical'),
      components: [newComponent('Collider'), newComponent('RigidBody')],
    },
    { ...meshNode('scripted'), components: [newComponent('Script')] },
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

  return [
    { id: 'S1', purpose: 'small-world overhead', state: state(small) },
    { id: 'S2', purpose: 'repeated-object instancing', state: state(repetition) },
    { id: 'S3', purpose: 'different static props batching', state: state(props) },
    { id: 'S4', purpose: 'city partitioning and culling', state: state(city) },
    { id: 'S5', purpose: 'mixed gameplay compatibility', state: state(mixed) },
  ]
}
