/**
 * What a scene is made of, shared by both processes. Like `domain/tool.ts`, it sits here
 * because the native menu needs the list and `shared/` cannot import from the renderer.
 *
 * The descriptors live here too, and not in `engines/`: they are the serialized form of a
 * document, which is what `shared/domain` is for — and it is what lets `MeshKind` be *derived*
 * from them instead of restated, so a geometry added without a menu entry fails to compile.
 */
import type { FontRef } from './font'

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
 * A camera the scene holds, as opposed to the one the viewport looks through. It is a node like
 * any other — pickable, movable, animatable by a track — and glTF carries one, so it survives an
 * export where a viewport setting never could.
 */
export type CameraDescriptor = {
  /** Vertical field of view, in degrees, as every other angle a person types. */
  fov: number
  near: number
  far: number
}

export const DEFAULT_CAMERA: CameraDescriptor = Object.freeze({ fov: 50, near: 0.1, far: 1000 })

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
export type ModelRef = { assetId: string; animation?: AnimationRef }

/**
 * Which clip of a model plays, and how. Absent on a model carrying none, and on every document
 * written before animation existed — the reader fills it in rather than refusing the node.
 *
 * The head position is part of it on purpose: an engine is rebuilt from its state, and a scene
 * reopened on frame one would lose the pose its author saved it on.
 */
export type AnimationRef = {
  /** The clip's name as the file spells it. A name the file no longer holds simply plays nothing. */
  clip: string
  playing: boolean
  /**
   * Where the head stands inside the clip, in SECONDS — three's mixer counts in them and this
   * rides straight into it. The scene's own timeline counts in microseconds (`Keyframe.time`):
   * the two meet only through `secondsToUs`, never by being handed to one another.
   */
  time: number
  /** A multiplier, never a frame rate: the clip carries its own timing. */
  speed: number
  loop: boolean
}

/** What a model animates like when nothing has been chosen: its first clip, stopped at the start. */
export const DEFAULT_ANIMATION: Omit<AnimationRef, 'clip'> = Object.freeze({
  playing: false,
  time: 0,
  speed: 1,
  loop: true,
})

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
 * A sprite: a picture that always faces the camera, whatever the view does.
 *
 * Not a geometry and not a material — nothing about it is three-dimensional, and it is lit by
 * nothing — which is why it is a node of its own rather than a mesh wearing a plane. Its size
 * is its transform's scale, like everything else in the scene.
 */
export type SpriteDescriptor = {
  /** `null` means the studio's own colour, resolved from the palette when the sprite is built. */
  color: string | null
  opacity: number
  /** What it draws. None leaves the plain coloured quad three.js gives a mapless sprite. */
  map: TextureRef | null
}

/**
 * Words, as a solid. The typeface is a reference like a texture or a model is, and for the same
 * reason: what a document stores has to be something a reload can resolve again — see
 * `domain/font`, which both workspaces that set text read.
 *
 * The face itself is never stored. A shipped one is a name the studio can always answer, and an
 * installed one is a name only that machine can — which is the missing-font hole, said out loud
 * rather than papered over by embedding half a megabyte of glyph tables in every scene file.
 */
export type TextDescriptor = {
  value: string
  font: FontRef
  /** Height of the em square, in scene units. A capital stands about seven tenths of it. */
  size: number
  /** How far the letters stand out of their own plane. Zero leaves them flat. */
  depth: number
  /** How finely the curves are cut. The cost of a letter is mostly here. */
  curveSegments: number
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

export type MeshKind = GeometryDescriptor['kind']

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
  { kind: 'tetrahedron' },
  { kind: 'torus' },
  { kind: 'torusKnot' },
  { kind: 'tube' },
]

/**
 * The files a scene can leave the studio as. `glb` is one binary file and the safe default;
 * `gltf` is its JSON form, readable and diffable; `usdz` is what Apple's viewers open.
 */
export type ExportFormat = 'glb' | 'gltf' | 'usdz'

export const EXPORT_FORMATS: readonly ExportFormat[] = ['glb', 'gltf', 'usdz']

/** The one place the studio's formats meet their file extensions. */
export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  glb: '.glb',
  gltf: '.gltf',
  usdz: '.usdz',
}

/** What is picked from the Add menu without being a mesh or a light. */
export type ObjectKind = 'sprite' | 'text' | 'camera'

export const OBJECT_ENTRIES: readonly SceneEntry<ObjectKind>[] = [
  { kind: 'sprite' },
  { kind: 'text' },
  { kind: 'camera' },
]

export const LIGHT_ENTRIES: readonly SceneEntry<LightKind>[] = [
  { kind: 'ambient' },
  { kind: 'directional' },
  { kind: 'hemisphere' },
  { kind: 'point' },
  { kind: 'spot' },
]
