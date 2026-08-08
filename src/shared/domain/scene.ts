/**
 * What a scene is made of, shared by both processes. Like `domain/tool.ts`, it sits here
 * because the native menu needs the list and `shared/` cannot import from the renderer.
 *
 * The descriptors live here too, and not in `engines/`: they are the serialized form of a
 * document, which is what `shared/domain` is for — and it is what lets `MeshKind` be *derived*
 * from them instead of restated, so a geometry added without a menu entry fails to compile.
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

/**
 * A texture is a reference to an asset of the project, never an image and never a three.js
 * object: an engine is rebuilt from its serialized state, so what a document stores has to be
 * something a reload can resolve again. The engine loads it, caches it and frees it.
 */
export type TextureRef = { assetId: string }

/**
 * An imported model, for the same reason and in the same shape as a texture: what a document
 * stores is what a reload can resolve again.
 *
 * One node holding a reference, never a subtree of nodes. A single GLB brings meshes by the
 * thousand, and a save was measured freezing every window past ~5500 nodes — the document grows
 * by one row here whatever the file weighs. The cost is that the inside of a model cannot be edited;
 * that is the right trade for a generation studio, and an explicit "explode" command is what
 * would lift it the day it matters.
 */
export type ModelRef = { assetId: string }

/**
 * What lights a viewport. `studio` is procedural — three builds a small lit room and prefilters
 * it — so a brand new document is already lit without the studio shipping an HDRI; anything else
 * is a skybox of the project, named by asset id like every other reference a document stores.
 */
export type EnvironmentRef = { kind: 'studio' } | { kind: 'skybox'; assetId: string }

export const STUDIO_ENVIRONMENT: EnvironmentRef = Object.freeze({ kind: 'studio' })

/**
 * What a stored value says about lighting, or the studio when it says nothing usable — a
 * document written before environments existed, a sky named without an id, a hand-edited file.
 */
export function readEnvironment(value: unknown): EnvironmentRef {
  if (typeof value !== 'object' || value === null) return STUDIO_ENVIRONMENT

  const held: { kind?: unknown; assetId?: unknown } = value
  return held.kind === 'skybox' && typeof held.assetId === 'string' && held.assetId !== ''
    ? { kind: 'skybox', assetId: held.assetId }
    : STUDIO_ENVIRONMENT
}

/**
 * How soft a shadow edge is, named as a person would rather than as three.js spells it — the
 * engine maps these onto its map types. Here because it is persisted, and `shared/` is where
 * what a settings file holds is described.
 *
 * Two words and not three: three.js 0.185 deprecated its softest filter and silently falls back
 * to the middle one, so a third option would have been a setting that changes nothing.
 */
export type ShadowQuality = 'hard' | 'soft'

export const SHADOW_QUALITIES: readonly ShadowQuality[] = ['hard', 'soft']

/** The sides a shadow map may take. A list, so a slider cannot suggest the values in between. */
export const SHADOW_MAP_SIZES: readonly number[] = [512, 1024, 2048, 4096]

/** The maps a `MeshStandardMaterial` reads, in the order the inspector lists them. */
export type TextureSlot = 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap'

export const TEXTURE_SLOTS: readonly TextureSlot[] = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
]

export type MaterialDescriptor = {
  kind: 'standard'
  /** `null` means the studio's own colour, resolved from the palette when the mesh is built. */
  color: string | null
  roughness: number
  metalness: number
} & { [S in TextureSlot]: TextureRef | null }

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

/** `sprite` and `text` are offered but not buildable yet: neither is a geometry. */
export type MeshKind = GeometryDescriptor['kind'] | 'sprite' | 'text'

export type LightKind = LightDescriptor['kind']

/**
 * An offered kind. The label is not carried: it is `<namespace>.<kind>` in both bundles, and a
 * copy of that string per entry is 22 chances to mistype what nothing would catch.
 */
export type SceneEntry<K> = {
  kind: K
  /** Declared but not buildable yet: shown greyed, so no menu hides what is coming. */
  disabled?: boolean
}

/**
 * Order taken from `three.js/editor/js/Menubar.Add.js`, which is alphabetical in English and
 * kept that way: a stable order across languages beats a sort that moves entries when the
 * language changes.
 */
export const MESH_ENTRIES: readonly SceneEntry<MeshKind>[] = [
  { kind: 'box' },
  { kind: 'capsule' },
  { kind: 'circle' },
  { kind: 'cylinder' },
  { kind: 'dodecahedron' },
  { kind: 'icosahedron' },
  { kind: 'lathe' },
  { kind: 'octahedron' },
  { kind: 'plane' },
  { kind: 'ring' },
  { kind: 'sphere' },
  { kind: 'sprite', disabled: true },
  { kind: 'tetrahedron' },
  { kind: 'text', disabled: true },
  { kind: 'torus' },
  { kind: 'torusKnot' },
  { kind: 'tube' },
]

export const LIGHT_ENTRIES: readonly SceneEntry<LightKind>[] = [
  { kind: 'ambient' },
  { kind: 'directional' },
  { kind: 'hemisphere' },
  { kind: 'point' },
  { kind: 'spot' },
]
