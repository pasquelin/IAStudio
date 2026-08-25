/**
 * The scene, as plain data. It holds no three.js object on purpose: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 *
 * The descriptors themselves live in `shared/domain/scene.ts`: they are what a saved document
 * contains, and the native menu builds its Add entries from the same kinds.
 */
import {
  DEFAULT_WORLD,
  type CameraDescriptor,
  type SceneWorld,
  type GeometryDescriptor,
  type LightDescriptor,
  type MaterialDescriptor,
  type ModelRef,
  type PathDescriptor,
  type SpriteDescriptor,
  type TextDescriptor,
  type Transform,
  type Vector3,
} from '@shared/domain/scene'
import type { CsgGraph } from '@shared/domain/csg'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { DEFAULT_FONT } from '@shared/domain/font'
import { cachedOn } from '../core/cachedOn'

export type SceneNodeBase = {
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
    | { type: 'sprite'; sprite: SpriteDescriptor }
    // A solid like a mesh, and lit like one — so it wears the same material, and the inspector's
    // material section serves it without knowing it exists.
    | { type: 'text'; text: TextDescriptor; material: MaterialDescriptor }
    // A solid cut out of other solids. It wears a material like a mesh, and its SHAPE is a
    // recipe rather than a descriptor — ADR-25: the graph is the document, the mesh is a cache.
    | { type: 'carved'; carved: CsgGraph; material: MaterialDescriptor }
    // Nothing of its own: a group is a transform others hang from, and a name to find it by.
    | { type: 'group' }
    // What a render looks through. Not the viewport's camera: that one is how the scene is being
    // WATCHED, and this one is part of what the scene IS.
    | { type: 'camera'; camera: CameraDescriptor }
    // A rail. Its points live in its own frame, so moving the node moves the whole trajectory.
    | { type: 'path'; path: PathDescriptor }
  )

/** Derived, never restated: a member added to the union above is a member here on the spot. */
export type SceneNodeType = SceneNode['type']

/** What the shadow rules read of a node — its type, and a light's kind. */
type ShadowSubject =
  { type: 'light'; light: LightDescriptor } | { type: Exclude<SceneNodeType, 'light'> }

/**
 * A flat ordered list, not a nested tree: reparenting becomes one field instead of moving a
 * subtree, lookups stay a find, and the serialized form never nests. The tree is derived.
 */
export type SceneState = {
  nodes: SceneNode[]
  /** Ordered, and the last one is the anchor: what the inspector reads out. See `helpers/selection`. */
  selectedIds: readonly string[]
  /** What lights the scene and what hangs behind it. Part of the document, and belongs to no node. */
  world: SceneWorld
  /** The tracks that move it through time. Where the head STANDS is session state, not this. */
  animation: AnimationTimeline
  /**
   * The axes held still, which `setTransform` refuses to write — so a padlock holds against the
   * viewport handle as much as against the field. Session state like `selectedIds`: no file
   * carries it, and it is written through `replace` rather than as a command.
   */
  lockedAxes?: readonly AxisLock[]
}

/** One axis of one channel of one node, held still. */
export type AxisLock = {
  nodeId: string
  channel: keyof Transform
  axis: keyof Vector3
}

/** Whether this axis is held, read off the state a command already receives. */
export function axisIsLocked(
  state: Pick<SceneState, 'lockedAxes'>,
  nodeId: string,
  channel: keyof Transform,
  axis: keyof Vector3,
): boolean {
  return (state.lockedAxes ?? []).some(
    lock => lock.nodeId === nodeId && lock.channel === channel && lock.axis === axis,
  )
}

/** The same list with one lock taken out or put in. */
export function withAxisLock(
  locks: readonly AxisLock[],
  lock: AxisLock,
  held: boolean,
): readonly AxisLock[] {
  const without = locks.filter(
    one => one.nodeId !== lock.nodeId || one.channel !== lock.channel || one.axis !== lock.axis,
  )
  return held ? [...without, lock] : without
}

/**
 * `next` with every held axis put back to where `from` had it. The whole reason the padlock holds
 * everywhere: both the inspector and the viewport write through `setTransform`.
 */
export function withoutLockedAxes(
  state: Pick<SceneState, 'lockedAxes'>,
  nodeId: string,
  from: Transform,
  next: Transform,
): Transform {
  if ((state.lockedAxes ?? []).length === 0) return next

  const channels: (keyof Transform)[] = ['position', 'rotation', 'scale']
  return channels.reduce((held, channel) => {
    const axes = XYZ.filter(axis => axisIsLocked(state, nodeId, channel, axis))
    if (axes.length === 0) return held

    return {
      ...held,
      [channel]: axes.reduce(
        (vector, axis) => ({ ...vector, [axis]: from[channel][axis] }),
        held[channel],
      ),
    }
  }, next)
}

const XYZ: readonly (keyof Vector3)[] = ['x', 'y', 'z']

/** Where a node ended up, reported by whatever moved it — a gizmo drag moves a whole selection. */
export type NodeMove = {
  id: string
  transform: Transform
  /** A bone of that node's model, when the pose mode moved one rather than the node itself. */
  bone?: string
  /**
   * Where the bone rested when it arrived. Carried with the move because that pose lives in the
   * FILE, not in the document — only the renderer ever knew it.
   */
  rest?: Transform
}

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
export function shadowDefaults(node: ShadowSubject): {
  castShadow: boolean
  receiveShadow: boolean
} {
  if (node.type === 'light') {
    return { castShadow: node.light.kind === 'directional', receiveShadow: false }
  }
  // Everything else defaults to what it is capable of: a mesh both throws and catches, a sprite
  // does neither, and nothing has to say so twice.
  return { castShadow: canCastShadow(node), receiveShadow: canReceiveShadow(node) }
}

/**
 * Whether a node can throw a shadow at all. An ambient or hemisphere light has no shadow camera,
 * and three.js warns once per frame about a light told to cast one — so the box is not offered
 * rather than offered and ignored. A sprite is never drawn into a shadow map: three.js walks
 * meshes there, and nothing else.
 */
export function canCastShadow(node: ShadowSubject): boolean {
  if (node.type === 'light') return SHADOW_CASTING_LIGHTS.includes(node.light.kind)
  // A camera draws nothing at all, so it can neither throw a shadow nor be drawn into a map.
  return node.type !== 'sprite' && node.type !== 'camera'
}

/** Whether a node catches the shadows of others. A light catches none, and a sprite is unlit. */
export function canReceiveShadow(node: ShadowSubject): boolean {
  return node.type !== 'light' && node.type !== 'sprite' && node.type !== 'camera'
}

/**
 * Whether turning a node shows anything. A sprite always faces the camera: three.js reads its size
 * off the *lengths* of the first two columns of the model matrix — which a rotation leaves
 * untouched — and takes its angle from a material uniform. Nodes hanging under one are the
 * exception: turning the sprite swings them around it, and that does show.
 *
 * The whole rule rather than the half the type answers, because three places have to agree: the
 * handle offered in the viewport, the row offered in the inspector, and the command that writes
 * the angle. Two of the three agreeing is how the angle stayed typeable after the handle was
 * refused.
 *
 * The children are asked for, not handed over: every one of the three is on a drag path, and only
 * a sprite makes the answer worth walking a scene for.
 */
export function rotationShows(node: { type: SceneNodeType }, children: () => boolean): boolean {
  return node.type !== 'sprite' || children()
}

export function hasChildren(nodes: readonly SceneNode[], id: string): boolean {
  return nodes.some(node => node.parentId === id)
}

const SHADOW_CASTING_LIGHTS: readonly LightDescriptor['kind'][] = ['directional', 'spot', 'point']

// Re-exported rather than moved away from its readers: it lives beside `Transform` now, because
// `shared/domain/rig.ts` rests a new bone on it and cannot reach into the renderer.
export { IDENTITY_TRANSFORM } from '@shared/domain/transform'

export const DEFAULT_MATERIAL: MaterialDescriptor = {
  kind: 'standard',
  color: null,
  roughness: 1,
  metalness: 0,
  /** One square per metre: the density at which the working checker reads as a measure. */
  tilesPerMetre: 1,
  map: null,
  normalMap: null,
  roughnessMap: null,
  metalnessMap: null,
  aoMap: null,
}

export const DEFAULT_SPRITE: SpriteDescriptor = {
  color: null,
  opacity: 1,
  map: null,
}

/**
 * A metre tall and slightly thick, in a face the studio ships: a text dropped into a scene reads
 * against the grid straight away, and opens the same on whatever machine it travels to.
 */
export const DEFAULT_TEXT: TextDescriptor = {
  value: 'Text',
  font: DEFAULT_FONT,
  size: 1,
  depth: 0.2,
  curveSegments: 6,
}

export const EMPTY_SCENE: SceneState = {
  nodes: [],
  selectedIds: [],
  world: DEFAULT_WORLD,
  animation: EMPTY_TIMELINE,
}

export type MeshNode = Extract<SceneNode, { type: 'mesh' }>
export type LightNode = Extract<SceneNode, { type: 'light' }>
export type ModelNode = Extract<SceneNode, { type: 'model' }>
export type SpriteNode = Extract<SceneNode, { type: 'sprite' }>
export type TextNode = Extract<SceneNode, { type: 'text' }>
export type CarvedNode = Extract<SceneNode, { type: 'carved' }>

/**
 * What wears a `MaterialDescriptor` — a mesh, a text and a solid, lit by the same rules and
 * served by one section of the inspector.
 *
 * Derived, never restated: the three sites that listed the types by hand each forgot the solid,
 * and each forgot it silently — a wall could be pierced and then not painted.
 */
export type MaterialNode = Extract<SceneNode, { material: MaterialDescriptor }>

export function carriesMaterial(node: SceneNode): node is MaterialNode {
  return 'material' in node
}
export type GroupNode = Extract<SceneNode, { type: 'group' }>
export type CameraNode = Extract<SceneNode, { type: 'camera' }>
export type PathNode = Extract<SceneNode, { type: 'path' }>

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

const cameraSets = new WeakMap<readonly SceneNode[], Set<string>>()

/**
 * The cameras a scene holds, in document order. Both readers are on the frame path — the shots
 * ask which cameras still exist, the fall back asks for the first — and both walked the whole
 * scene to answer: measured 18/08 on `cameraShots.bench`, 7,2 µs a call over 5 000 nodes and
 * 73 µs over 50 000 with a shot covering the instant, 15 and 151 µs on the fall back, against
 * 0,1 µs whatever the count.
 */
export function cameraIds(nodes: readonly SceneNode[]): Set<string> {
  return cachedOn(cameraSets, nodes, () => new Set(nodesOfType(nodes, 'camera').map(n => n.id)))
}

/**
 * What a render looks through: the first camera the scene holds, in document order.
 *
 * `null` for a scene that has none, which is not a failure — a model dropped straight onto a
 * montage is drawn by the free camera instead. The rule lives here rather than at its two call
 * sites so that what the Render button writes and what a montage shows cannot disagree.
 */
export function firstCameraId(nodes: readonly SceneNode[]): string | null {
  return cameraIds(nodes).values().next().value ?? null
}
