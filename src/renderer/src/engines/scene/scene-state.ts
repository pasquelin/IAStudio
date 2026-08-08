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
  ModelRef,
  Transform,
} from '@shared/domain/scene'

export type SceneNodeType = 'mesh' | 'light' | 'model'

type SceneNodeBase = {
  id: string
  /** `null` is a direct child of the scene. Reparenting is not offered yet. */
  parentId: string | null
  name: string
  visible: boolean
  transform: Transform
  /** Throws a shadow. On a light, whether it casts any at all — six renders a frame for a point. */
  castShadow: boolean
  /** Catches the shadows of others. Meaningless on a light, and ignored there. */
  receiveShadow: boolean
}

export type SceneNode = SceneNodeBase &
  (
    | { type: 'mesh'; geometry: GeometryDescriptor; material: MaterialDescriptor }
    | { type: 'light'; light: LightDescriptor }
    | { type: 'model'; model: ModelRef }
  )

/**
 * A flat ordered list, not a nested tree: reparenting becomes one field instead of moving a
 * subtree, lookups stay a find, and the serialized form never nests. The tree is derived.
 */
export type SceneState = {
  nodes: SceneNode[]
  /** Ordered, and the last one is the anchor: what the inspector reads out. See `helpers/selection`. */
  selectedIds: readonly string[]
}

/** Where a node ended up, reported by whatever moved it — a gizmo drag moves a whole selection. */
export type NodeMove = { id: string; transform: Transform }

/**
 * What a node without shadow flags means — a document written before they existed, which is
 * every one saved so far.
 *
 * A mesh both throws and catches: that is what makes a scene read as lit rather than as a set of
 * cut-outs. Of the lights, only the directional one throws by default: it is what carries the key
 * of a scene. A point light is six renders of the whole scene per frame, and a spot — one render,
 * like the directional — points down at a set nobody aimed it at yet, where it mostly produces
 * acne. Both are one checkbox away in the inspector.
 */
export function shadowDefaults(
  node: { type: 'light'; light: LightDescriptor } | { type: 'mesh' | 'model' },
): { castShadow: boolean; receiveShadow: boolean } {
  if (node.type !== 'light') return { castShadow: true, receiveShadow: true }
  return { castShadow: node.light.kind === 'directional', receiveShadow: false }
}

/**
 * Whether a node can throw a shadow at all. An ambient or hemisphere light has no shadow camera,
 * and three.js warns once per frame about a light told to cast one — so the box is not offered
 * rather than offered and ignored.
 */
export function canCastShadow(node: SceneNode): boolean {
  return node.type !== 'light' || SHADOW_CASTING_LIGHTS.includes(node.light.kind)
}

const SHADOW_CASTING_LIGHTS: readonly LightDescriptor['kind'][] = ['directional', 'spot', 'point']

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

export const EMPTY_SCENE: SceneState = { nodes: [], selectedIds: [] }

export type MeshNode = Extract<SceneNode, { type: 'mesh' }>
export type LightNode = Extract<SceneNode, { type: 'light' }>
export type ModelNode = Extract<SceneNode, { type: 'model' }>

export function nodeById(state: SceneState, id: string): SceneNode | null {
  return state.nodes.find(node => node.id === id) ?? null
}

/**
 * What an edit acts on, in the order the selection was built — so the last one is the anchor the
 * inspector reads out. Ids nothing answers to are dropped rather than reported as holes.
 *
 * The two halves are taken apart rather than a whole `SceneState`: every caller reads them as two
 * selectors, precisely so that selecting a node does not re-render what only watches the nodes.
 */
export function selectedNodes(
  nodes: readonly SceneNode[],
  selectedIds: readonly string[],
): SceneNode[] {
  const byId = new Map(nodes.map(node => [node.id, node]))
  return selectedIds.flatMap(id => byId.get(id) ?? [])
}

export function childrenOf(state: SceneState, parentId: string | null): SceneNode[] {
  return state.nodes.filter(node => node.parentId === parentId)
}

/** The half of the scene a panel is about — meshes or lights. */
export function nodesOfType(nodes: readonly SceneNode[], type: SceneNodeType): SceneNode[] {
  return nodes.filter(node => node.type === type)
}
