/**
 * What a scene is made of, shared by both processes. Like `domain/tool.ts`, it sits here
 * because the native menu needs the list and `shared/` cannot import from the renderer.
 *
 * The descriptors live here too, and not in `engines/`: they are the serialized form of a
 * document, which is what `shared/domain` is for — and it is what lets `MeshKind` be *derived*
 * from them instead of restated, so a geometry added without a menu entry fails to compile.
 */
import type { FontRef } from './font'
import type { BodyPart } from './humanoid'
import type { Rig } from './rig'
import type { Us } from './time'
import type { Vector3 } from './transform'

/** Re-exported so the fifty-odd files that read a pose from here keep reading it from here. */
export { isTransform, isVector3, type Transform, type Vector3 } from './transform'

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
 * A rail: the line a camera runs along during a shot.
 *
 * A node of the scene like any other, so it inherits the outliner row, the selection, the gizmo,
 * the rename, the visibility, undo, copy and paste — everything `SceneNode` already gives.
 *
 * `kind` is an open union: a Bézier one would be another value here, and no document written
 * before it would have to be migrated.
 */
export type PathDescriptor = {
  kind: 'catmullrom'
  /** In the node's OWN frame, so moving the rail moves the trajectory. Two at the very least. */
  points: readonly Vector3[]
  closed: boolean
  /** Catmull-Rom tension: 0 is angular, 0.5 is three.js's own default. */
  tension: number
}

export const DEFAULT_PATH: PathDescriptor = Object.freeze({
  kind: 'catmullrom',
  // Five units apart along Z, which is the axis a camera born from the Add menu looks down.
  points: Object.freeze([
    Object.freeze({ x: 0, y: 0, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: -5 }),
  ]),
  closed: false,
  tension: 0.5,
})

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
export type ModelRef = {
  assetId: string
  /** The skeleton the studio put on this model. The one exception to the rule above — see `rig.ts`. */
  rig?: Rig
  /** What plays on this model: one lane per layer, and the blocks inside each. */
  lanes?: readonly ClipLane[]
  /**
   * @deprecated Read when a document written before lanes existed is opened, and folded into a
   * single lane. Never written again.
   */
  clips?: readonly ClipRef[]
  /**
   * @deprecated Read when a document written before clips were plural is opened, and converted
   * into a single `ClipRef`. Never written again.
   */
  animation?: AnimationRef
  /**
   * Maps of the project put over the ones the file carries, slot by slot.
   *
   * A slot that is absent leaves what the GLB brought, which is why this is a partial and not the
   * `MaterialDescriptor` a mesh wears: overriding a model means REPLACING one picture, never
   * restating a colour and a roughness the file already got right.
   *
   * It applies to every material of the model at once. A file whose materials want different
   * maps is not addressable here — the inside of a model is not a thing this document holds
   * (see above), so there is no name to hang a per-material override on.
   */
  textures?: Partial<Record<TextureSlot, TextureRef>>
}

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
  /**
   * Where the block sits on the scene's band, in MICROSECONDS — the unit that band counts in,
   * unlike `time` just above, which is three's own clock inside the clip.
   *
   * It is what makes a clip a block one can move rather than something that simply runs: before
   * the head reaches it the model stands at its rest pose, and the render walks it frame by
   * frame instead of leaving it wherever real time happened to leave it.
   */
  start: Us
}

/**
 * Where a clip's frames come from.
 *
 * `embedded` is the file the model itself is: the name is the one the GLB spells. `bundled` is a
 * folder shipped beside the app, named by that FOLDER — never by what its clip spells, which is
 * `NlaTrack` on a Tripo rig and nothing at all on Uthana's. `asset` is a clip of the project's
 * own library, reusable by any character.
 */
export type ClipSource =
  | { kind: 'embedded'; name: string }
  | { kind: 'bundled'; name: string }
  | { kind: 'asset'; assetId: string; name: string }

/**
 * What a block's clip is filed under, wherever a player or a length is kept by name.
 *
 * The kind is part of it, and that is the whole point: an animation shipped as `walk` and a clip
 * the model's own file spells `walk` are two different things, and a bare name would play one
 * for the other.
 */
export function clipKeyOf(source: ClipSource): string {
  if (source.kind === 'embedded') return source.name
  // The id and not the name: two library clips may well be called the same thing.
  return source.kind === 'asset' ? `asset:${source.assetId}` : `bundled:${source.name}`
}

/**
 * One block of animation on a model's band.
 *
 * MIND THE UNITS, and they are not the same in both halves of this type: `start`, `duration`,
 * `fadeIn` and `fadeOut` are MICROSECONDS, the unit the band counts in; `offset` is SECONDS,
 * three's own clock inside the clip. The two meet only through `secondsToUs` / `usToSeconds`,
 * never by being handed to one another.
 */
export type ClipRef = {
  /** Minted by the studio, so two blocks of the same clip are still two blocks. */
  id: string
  source: ClipSource
  /**
   * The words shown for this block. The studio OWNS them and never takes them from the file:
   * a Tripo rig spells its only clip `NlaTrack`, and Uthana's carries no name at all.
   */
  label: string
  /** Where the block sits on the band. */
  start: Us
  /** How much band it takes. `0` means "not measured yet" — the length lives in the file. */
  duration: Us
  /** Where playback starts INSIDE the clip, in three's seconds. */
  offset: number
  /** A multiplier, never a frame rate: the clip carries its own timing. */
  speed: number
  loop: boolean
  fadeIn: Us
  fadeOut: Us
  /** `auto` lets the studio decide from what the clip actually holds. */
  rootMotion: RootMotion
  /**
   * Which bones this block drives. Absent is the whole body — what every document written before
   * this field says, and what a lone block wants anyway.
   *
   * It is what makes « walking AND raising the arms » something other than the average of the
   * two: blocks driving different halves stop sharing the pose out between them.
   */
  part?: BodyPart
}

/**
 * One layer of blocks on a model's track, and several of them stack.
 *
 * A lane is what makes two moves play AT ONCE — a walk under a wave — where blocks laid in one
 * lane simply take turns. It exists even while empty: an object has its lane before it has
 * anything to put in it.
 */
export type ClipLane = {
  id: string
  clips: readonly ClipRef[]
}

/**
 * The lane a document written before lanes existed describes, and the one a model is given when
 * it first needs somewhere to drop a block. Fixed rather than minted, so reopening a file twice
 * gives the same document.
 */
export const MAIN_LANE_ID = 'main'

export function clipLane(id: string, clips: readonly ClipRef[] = []): ClipLane {
  return { id, clips }
}

export type RootMotion = 'inPlace' | 'travel' | 'auto'

export const ROOT_MOTIONS: readonly RootMotion[] = ['inPlace', 'travel', 'auto']

/** What a block is worth before anything is chosen for it. */
export const DEFAULT_CLIP: Omit<ClipRef, 'id' | 'source' | 'label'> = Object.freeze({
  start: 0,
  duration: 0,
  offset: 0,
  speed: 1,
  loop: true,
  fadeIn: 0,
  fadeOut: 0,
  rootMotion: 'auto',
})

/**
 * A block on one of the clips a model's own file brought.
 *
 * `extra` goes UNDER the identity, so carrying a previous block over cannot smuggle in the clip
 * it used to play.
 */
export function embeddedClip(id: string, name: string, extra: Partial<ClipRef> = {}): ClipRef {
  return { ...DEFAULT_CLIP, ...extra, id, source: { kind: 'embedded', name }, label: name }
}

/** A block on an animation shipped with the app, named — and labelled — by its folder. */
export function bundledClip(id: string, name: string, extra: Partial<ClipRef> = {}): ClipRef {
  return { ...DEFAULT_CLIP, ...extra, id, source: { kind: 'bundled', name }, label: name }
}

/**
 * A block on an animation the PROJECT holds: a file of its own, played on another character.
 *
 * The name is the asset's, which is a file's stem rather than anything the clip inside spells —
 * `NlaTrack` and `animation_0` are what those spell, and neither may reach the screen.
 */
export function assetClip(
  id: string,
  assetId: string,
  name: string,
  extra: Partial<ClipRef> = {},
): ClipRef {
  return { ...DEFAULT_CLIP, ...extra, id, source: { kind: 'asset', assetId, name }, label: name }
}

/**
 * The block a document written before clips were plural describes.
 *
 * The id is fixed rather than minted so that reopening a file twice gives the same document; that
 * form holds one clip per model, so a constant is unique where it has to be.
 */
export function clipFromAnimation(animation: AnimationRef): ClipRef {
  return embeddedClip('legacy', animation.clip, {
    // Checked rather than read: `start` came late, and a document older than it holds none —
    // the reader that lets such a node through does not require it either.
    start: Number.isFinite(animation.start) ? animation.start : 0,
    offset: animation.time,
    // `playing` is deliberately dropped: whether a block runs on real time is session state now
    // (see `SelfPlay`), and a document reopening mid-walk would put an undo entry behind a play
    // button.
    speed: animation.speed,
    loop: animation.loop,
  })
}

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

/** What is picked from the Add menu without being a mesh or a light. */
export type ObjectKind = 'sprite' | 'text' | 'camera' | 'path'

export const OBJECT_ENTRIES: readonly SceneEntry<ObjectKind>[] = [
  { kind: 'sprite' },
  { kind: 'text' },
  { kind: 'camera' },
  { kind: 'path' },
]

export const LIGHT_ENTRIES: readonly SceneEntry<LightKind>[] = [
  { kind: 'ambient' },
  { kind: 'directional' },
  { kind: 'hemisphere' },
  { kind: 'point' },
  { kind: 'spot' },
]

// How a scene is being looked at, and drawn, starts here. Session state, like an image document's
// zoom: never saved with the document, and ⌘Z never touches it — the scene did not change, the
// view did. Declared here rather than beside the renderer that applies them, and for the same
// reason `MESH_ENTRIES` is: the native menu offers a row per value and is built in the main
// process, which cannot import a renderer module.

/** The six sides of the box a set is judged from. */
export type ViewDirection = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'

export const VIEW_DIRECTIONS: readonly ViewDirection[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
]

/** A toolbar row and a menu row both carry a plain string: this turns one back into a direction. */
export function isViewDirection(value: string): value is ViewDirection {
  return VIEW_DIRECTIONS.some(direction => direction === value)
}

/**
 * What the viewport draws. Seven answers, and the order is the order the key cycles through:
 * the three the studio opened with first, then the four a model is judged by.
 *
 * `solid`, `matcap` and `density` paint every surface with one stand-in material, so what shows
 * is the SHAPE — a matcap reads curvature the way a clay render does, and density says which
 * object of a set carries the triangles. `material` keeps the real materials but drops the
 * scene's own lights, which is how a texture is judged without a light flattering it.
 */
export type DisplayMode =
  | 'shaded'
  | 'wireframe'
  | 'both'
  | 'solid'
  | 'material'
  | 'matcap'
  | 'density'
  /** Surfaces barely there, so the skeleton inside is what reads. */
  | 'ghost'
  /** No surface at all. What is left is the skeleton, which is drawn outside the scene graph. */
  | 'skeleton'

export const DISPLAY_MODES: readonly DisplayMode[] = [
  'shaded',
  'wireframe',
  'both',
  'solid',
  'material',
  'matcap',
  'density',
  'ghost',
  'skeleton',
]

export function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.some(mode => mode === value)
}
