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
}

export const EMPTY_SCENE: SceneState = { nodes: [], selectedId: null }

export function nodeById(state: SceneState, id: string): SceneNode | null {
  return state.nodes.find(node => node.id === id) ?? null
}

export function childrenOf(state: SceneState, parentId: string | null): SceneNode[] {
  return state.nodes.filter(node => node.parentId === parentId)
}

/** The half of the scene a panel is about — meshes or lights. */
export function nodesOfType(nodes: readonly SceneNode[], type: SceneNodeType): SceneNode[] {
  return nodes.filter(node => node.type === type)
}

export function serializeScene(state: SceneState): string {
  return JSON.stringify(state)
}

/** Unreadable input yields an empty scene: a blank viewport beats an uncaught throw. */
export function deserializeScene(raw: string): SceneState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('nodes' in parsed)) return EMPTY_SCENE
    // The two guards above established the shape; `JSON.parse` can only hand back `unknown`.
    const { nodes, selectedId } = parsed as Partial<SceneState>
    if (!Array.isArray(nodes)) return EMPTY_SCENE
    return { nodes, selectedId: typeof selectedId === 'string' ? selectedId : null }
  } catch {
    return EMPTY_SCENE
  }
}
