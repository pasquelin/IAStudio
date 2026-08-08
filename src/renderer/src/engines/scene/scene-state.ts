/**
 * The scene, as plain data. It holds no three.js object on purpose: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 *
 * The descriptors themselves live in `shared/domain/scene.ts`: they are what a saved document
 * contains, and the native menu builds its Add entries from the same kinds.
 */
import {
  STUDIO_ENVIRONMENT,
  type EnvironmentRef,
  type GeometryDescriptor,
  type LightDescriptor,
  type MaterialDescriptor,
  type ModelRef,
  type Transform,
} from '@shared/domain/scene'

export type SceneNodeType = 'mesh' | 'light' | 'model' | 'group'

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
    // Nothing of its own: a group is a transform others hang from, and a name to find it by.
    | { type: 'group' }
  )

/**
 * A flat ordered list, not a nested tree: reparenting becomes one field instead of moving a
 * subtree, lookups stay a find, and the serialized form never nests. The tree is derived.
 */
export type SceneState = {
  nodes: SceneNode[]
  /** Ordered, and the last one is the anchor: what the inspector reads out. See `helpers/selection`. */
  selectedIds: readonly string[]
  /** What lights the scene, and what its materials reflect. Part of the document. */
  environment: EnvironmentRef
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
  node: { type: 'light'; light: LightDescriptor } | { type: 'mesh' | 'model' | 'group' },
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

export const EMPTY_SCENE: SceneState = {
  nodes: [],
  selectedIds: [],
  environment: STUDIO_ENVIRONMENT,
}

export type MeshNode = Extract<SceneNode, { type: 'mesh' }>
export type LightNode = Extract<SceneNode, { type: 'light' }>
export type ModelNode = Extract<SceneNode, { type: 'model' }>
export type GroupNode = Extract<SceneNode, { type: 'group' }>

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

/**
 * Whether a node may hang from a parent — which is to say, whether doing so would make a loop.
 *
 * A node cannot become its own descendant's child: the tree would close on itself, and every
 * walk of it would run forever. This is the classic bug of the feature, so it is one function
 * with one test rather than a check written wherever a parent is chosen.
 */
export function canReparent(
  nodes: readonly SceneNode[],
  id: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true

  const byId = new Map(nodes.map(node => [node.id, node]))
  let walker: SceneNode | undefined = byId.get(parentId)
  while (walker) {
    if (walker.id === id) return false
    walker = walker.parentId === null ? undefined : byId.get(walker.parentId)
  }
  // The chain from the wanted parent never met the node, so hanging it there closes nothing.
  return parentId !== id
}

/**
 * Every node under one, itself included — what a delete has to carry along.
 *
 * Walked through an index rather than in declared order: reparenting changes a `parentId` in
 * place, so a child can perfectly well be listed before the parent it now hangs from. Reading
 * the array in order left those behind — nodes nothing showed any more, and the file kept.
 */
export function subtreeOf(nodes: readonly SceneNode[], id: string): SceneNode[] {
  const byParent = new Map<string | null, SceneNode[]>()
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId)
    if (siblings) siblings.push(node)
    else byParent.set(node.parentId, [node])
  }

  const found = nodes.filter(node => node.id === id)
  // Indexed rather than iterated: the loop appends as it walks, which is the descent itself.
  for (let at = 0; at < found.length; at += 1) {
    const node = found[at]
    if (node) found.push(...(byParent.get(node.id) ?? []))
  }
  return found
}

/** The half of the scene a panel is about — meshes or lights. */
export function nodesOfType(nodes: readonly SceneNode[], type: SceneNodeType): SceneNode[] {
  return nodes.filter(node => node.type === type)
}
