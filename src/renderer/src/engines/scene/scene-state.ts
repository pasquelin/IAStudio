/**
 * The scene, as plain data. It holds no three.js object on purpose: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 *
 * The descriptors themselves live in `shared/domain/scene.ts`: they are what a saved document
 * contains, and the native menu builds its Add entries from the same kinds.
 */
import type {
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  Transform,
} from '@shared/domain/scene'

export type SceneNodeType = 'mesh' | 'light'

type SceneNodeBase = {
  id: string
  /** `null` is a direct child of the scene. Reparenting is not offered yet. */
  parentId: string | null
  name: string
  visible: boolean
  transform: Transform
}

export type SceneNode = SceneNodeBase &
  (
    | { type: 'mesh'; geometry: GeometryDescriptor; material: MaterialDescriptor }
    | { type: 'light'; light: LightDescriptor }
  )

/**
 * A flat ordered list, not a nested tree: reparenting becomes one field instead of moving a
 * subtree, lookups stay a find, and the serialized form never nests. The tree is derived.
 */
export type SceneState = {
  nodes: SceneNode[]
  selectedId: string | null
}

export const IDENTITY_TRANSFORM: Transform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
}

export const DEFAULT_MATERIAL: MaterialDescriptor = {
  kind: 'standard',
  color: null,
  roughness: 1,
  metalness: 0,
  map: null,
  normalMap: null,
  roughnessMap: null,
  metalnessMap: null,
  aoMap: null,
}

export const EMPTY_SCENE: SceneState = { nodes: [], selectedId: null }

export type MeshNode = Extract<SceneNode, { type: 'mesh' }>
export type LightNode = Extract<SceneNode, { type: 'light' }>

export function nodeById(state: SceneState, id: string): SceneNode | null {
  return state.nodes.find(node => node.id === id) ?? null
}

/** What the panels act on: the node the selection points at, or nothing. */
export function selectedNode(state: SceneState): SceneNode | null {
  return state.selectedId ? nodeById(state, state.selectedId) : null
}

export function childrenOf(state: SceneState, parentId: string | null): SceneNode[] {
  return state.nodes.filter(node => node.parentId === parentId)
}

/** The half of the scene a panel is about — meshes or lights. */
export function nodesOfType(nodes: readonly SceneNode[], type: SceneNodeType): SceneNode[] {
  return nodes.filter(node => node.type === type)
}
