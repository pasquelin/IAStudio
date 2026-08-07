/**
 * The scene, as plain data. It holds no three.js object on purpose: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has no WebGL context to test against.
 */
export type Vector3 = { x: number; y: number; z: number }

export type Transform = {
  position: Vector3
  /** Euler angles, in radians. */
  rotation: Vector3
  scale: Vector3
}

/**
 * Each primitive carries its own parameters rather than a shared bag of optionals: a sphere has
 * no depth, and a type that lets it have one stops describing anything.
 */
export type GeometryDescriptor =
  | { kind: 'box'; width: number; height: number; depth: number }
  | { kind: 'capsule'; radius: number; height: number; capSegments: number; radialSegments: number }
  | { kind: 'circle'; radius: number; segments: number }
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments: number }
  | { kind: 'dodecahedron'; radius: number }
  | { kind: 'icosahedron'; radius: number }
  | { kind: 'lathe'; segments: number }
  | { kind: 'octahedron'; radius: number }
  | { kind: 'plane'; width: number; height: number }
  | { kind: 'ring'; innerRadius: number; outerRadius: number; segments: number }
  | { kind: 'sphere'; radius: number; widthSegments: number; heightSegments: number }
  | { kind: 'tetrahedron'; radius: number }
  | { kind: 'torus'; radius: number; tube: number; radialSegments: number; tubularSegments: number }
  | {
      kind: 'torusKnot'
      radius: number
      tube: number
      tubularSegments: number
      radialSegments: number
      p: number
      q: number
    }
  | { kind: 'tube'; radius: number; tubularSegments: number; radialSegments: number }

export type MaterialDescriptor = {
  kind: 'standard'
  /** `null` means the studio's own colour, resolved from the palette when the mesh is built. */
  color: string | null
  roughness: number
  metalness: number
}

/**
 * `target` is a point, not an object. three.js aims a light at an `Object3D`, and the official
 * editor shows that object in its outliner — but a node that cannot be renamed, hidden or
 * deleted is a property that leaked into the tree, and it doubles the length of a lit scene.
 */
export type LightDescriptor =
  | { kind: 'ambient'; color: string; intensity: number }
  | { kind: 'directional'; color: string; intensity: number; target: Vector3 }
  | { kind: 'hemisphere'; skyColor: string; groundColor: string; intensity: number }
  | { kind: 'point'; color: string; intensity: number; distance: number; decay: number }
  | {
      kind: 'spot'
      color: string
      intensity: number
      distance: number
      angle: number
      penumbra: number
      decay: number
      target: Vector3
    }

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
