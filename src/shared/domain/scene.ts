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
import type { GeometryDescriptor } from './geometry'
import type { Vector3 } from './transform'

/** Re-exported so the fifty-odd files that read a pose from here keep reading it from here. */
export { isTransform, isVector3, type Transform, type Vector3 } from './transform'

/** Re-exported for the same reason as the transform above: this is where a scene is read from. */
export type { GeometryDescriptor } from './geometry'

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
   * The MATERIAL this model wears, by the id of its document.
   *
   * A reference, never a copy: what the material holds is resolved when the scene is READ, so
   * editing that material — swapping the picture in a channel, turning a dial — reaches every
   * model wearing it. It rides in `extras[studio]` verbatim, so no glTF reader sees it and no
   * format head changes.
   *
   * Named by a gesture rather than guessed from the mesh: one `.glb` can have any number of
   * materials assembled from it, and picking one would be a draw.
   */
  materialDocumentId?: string
}

/**
 * What a MATERIAL is worth to a model — its maps by slot, and the dials a plain standard material
 * reads. Resolved from the document the node names, never stored on the node.
 */
export type ModelDress = {
  textures: Partial<Record<TextureSlot, TextureRef>>
  material: ModelMaterial
}

/** What a model wears over its file. Every field optional: absent leaves what the glTF said. */
export type ModelMaterial = {
  color?: string
  roughness?: number
  metalness?: number
  normalScale?: number
  aoIntensity?: number
  emissive?: string
  emissiveIntensity?: number
  /** Repeat and shift of every map at once — applied to the textures, not to the material. */
  tiling?: { x: number; y: number }
  offset?: { x: number; y: number }
  /** Radians. */
  rotation?: number
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

export const CLIP_SOURCES: readonly ClipSource['kind'][] = ['embedded', 'bundled', 'asset']

/**
 * What a block may be sped up or slowed to. Zero would make it infinitely long, and past four
 * times a motion reads as a glitch rather than as a faster move.
 *
 * Here rather than in the engine that reads it, for the reason `TILES_PER_METRE` is: it bounds
 * what a DOCUMENT may hold, so the registry on this side of the boundary can state it too.
 */
export const CLIP_SPEED = Object.freeze({ min: 0.1, max: 4 })

/** Seconds. Past a second a transition stops reading as one move joining another. */
export const MAX_CLIP_FADE = 1

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
 * Derived, never restated — the same rule `BACKGROUND_KINDS` follows.
 *
 * The two are EXCLUSIVE, and that is the whole reason a panel names them: a scene is lit by one
 * prefiltered map, so choosing a sky is what puts the procedural studio out.
 */
export const ENVIRONMENT_KINDS: readonly EnvironmentRef['kind'][] = ['studio', 'skybox']

/**
 * The ready-made worlds a scene can be set up as. Only the names live here — what each one WRITES
 * is a patch of `SceneWorld` the engine holds, and it needs a comparison the window owns.
 */
export type EnvironmentPreset = 'neutral' | 'studio' | 'product' | 'outdoor' | 'night'

export const ENVIRONMENT_PRESETS: readonly EnvironmentPreset[] = [
  'neutral',
  'studio',
  'product',
  'outdoor',
  'night',
]

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
 * What hangs behind the scene. `environment` is what every document written so far describes: the
 * sky when one is chosen, the studio's own backdrop token otherwise.
 *
 * `transparent` keeps nothing behind the subject, which is what a capture laid over something
 * else needs — the montage already renders that way, through a path of its own.
 */
export type BackgroundDescriptor =
  | {
      kind: 'environment'
      /**
       * `scene.backgroundBlurriness`, 0 to 1. Softens the PICTURE alone: what the materials
       * reflect goes on being read from the sharp map, which is what lets a sky serve as a
       * backdrop without turning every specular into a smear.
       */
      blur: number
    }
  | { kind: 'color'; color: string }
  | { kind: 'transparent' }

export const DEFAULT_BACKGROUND: BackgroundDescriptor = Object.freeze({
  kind: 'environment',
  blur: 0,
})

/** Derived, never restated: a fourth shape above is a fourth button on the spot. */
export const BACKGROUND_KINDS: readonly BackgroundDescriptor['kind'][] = [
  'environment',
  'color',
  'transparent',
]

/**
 * Distance haze. `linear` fades between two distances, `exp2` thickens with depth — three.js's
 * `Fog` and `FogExp2`, named as a person would rather than as the library spells them.
 */
export type FogDescriptor =
  | { kind: 'none' }
  | { kind: 'linear'; color: string; near: number; far: number }
  | { kind: 'exp2'; color: string; density: number }

type LinearFog = Extract<FogDescriptor, { kind: 'linear' }>
type Exp2Fog = Extract<FogDescriptor, { kind: 'exp2' }>

export const FOG_KINDS: readonly FogDescriptor['kind'][] = ['none', 'linear', 'exp2']

export const NO_FOG: FogDescriptor = Object.freeze({ kind: 'none' })

/** What a fog gains when it is first turned on, so the two forms open on something visible. */
export const DEFAULT_LINEAR_FOG: LinearFog = Object.freeze({
  kind: 'linear',
  color: '#9aa4b2',
  near: 10,
  far: 60,
})

export const DEFAULT_EXP2_FOG: Exp2Fog = Object.freeze({
  kind: 'exp2',
  color: '#9aa4b2',
  density: 0.02,
})

/**
 * How high dynamic range is brought down to a screen. The five three.js 0.185 actually maps —
 * a sixth word here would be a control that changes nothing.
 */
export type ToneMapping = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces'

export const TONE_MAPPINGS: readonly ToneMapping[] = [
  'none',
  'linear',
  'reinhard',
  'cineon',
  'aces',
]

/**
 * A ground plane the scene owns — an object shadows land on, never the viewport's grid. The two
 * are deliberately separate: one is what the scene IS, the other is how it is being looked at.
 */
export type GroundDescriptor = {
  visible: boolean
  /** `null` is the studio's own colour, resolved from the palette like a mesh's. */
  color: string | null
  /** Side of the square, in scene units. */
  size: number
  opacity: number
  receiveShadow: boolean
}

export const DEFAULT_GROUND: GroundDescriptor = Object.freeze({
  visible: false,
  color: null,
  size: 20,
  opacity: 1,
  receiveShadow: true,
})

/**
 * How a scene is WALKED rather than watched — what the window that plays a set will fly, and
 * what a template settles for it.
 *
 * Nothing reads it today, and that is deliberate (decision of 20/08): these are document values,
 * so a template that means « first person, feet on the ground » has to be able to say so before
 * the player exists. Added later, every scene written until then would open on a default nobody
 * chose, and a template's intent would be lost.
 */
export type PlayCamera = 'orbit' | 'firstPerson' | 'thirdPerson' | 'topDown'

export const PLAY_CAMERAS: readonly PlayCamera[] = [
  'orbit',
  'firstPerson',
  'thirdPerson',
  'topDown',
]

export type ScenePlay = {
  camera: PlayCamera
  /** Metres above the floor: the eye in first person, the pivot the camera holds in the others. */
  eyeHeight: number
  /** Metres per second, on the flat. */
  moveSpeed: number
  /** Metres per second squared, downward. Zero flies — which is what `orbit` means here. */
  gravity: number
}

export const DEFAULT_PLAY: ScenePlay = Object.freeze({
  camera: 'orbit',
  eyeHeight: 1.7,
  moveSpeed: 4,
  gravity: 0,
})

/** Bounds a stored value is held to, so a hand-edited file cannot fly a set at Mach 3. */
export const EYE_HEIGHT = Object.freeze({ min: 0.1, max: 10, step: 0.05 })
export const MOVE_SPEED = Object.freeze({ min: 0.1, max: 50, step: 0.1 })
export const GRAVITY = Object.freeze({ min: 0, max: 50, step: 0.01 })

/**
 * What lights a scene and what hangs behind it — the half of a document that belongs to no node.
 *
 * Every default below is what the studio already did before this type existed, so opening a
 * document written without it changes nothing on screen.
 */
export type SceneWorld = {
  environment: EnvironmentRef
  /** Multiplies both what the environment lights with and what it draws behind the scene. */
  envIntensity: number
  /** Radians around the vertical axis. Turns the picture and the reflections together. */
  envRotation: number
  background: BackgroundDescriptor
  fog: FogDescriptor
  toneMapping: ToneMapping
  /** `renderer.toneMappingExposure`. Read even when the mapping is `none`, as three.js does. */
  exposure: number
  ground: GroundDescriptor
  play: ScenePlay
}

export const DEFAULT_WORLD: SceneWorld = Object.freeze({
  environment: STUDIO_ENVIRONMENT,
  envIntensity: 1,
  envRotation: 0,
  background: DEFAULT_BACKGROUND,
  fog: NO_FOG,
  // `none` and not `aces`: the 3D viewport has always drawn without tone mapping, and turning it
  // on here would change how every existing project lands.
  toneMapping: 'none',
  exposure: 1,
  ground: DEFAULT_GROUND,
  play: DEFAULT_PLAY,
})

/** Bounds a slider and a stored value are both held to. */
export const ENV_INTENSITY = Object.freeze({ min: 0, max: 3, step: 0.05 })
/** `scene.backgroundBlurriness` takes 0 to 1 and clamps past it, so the bounds are the API's. */
export const BACKGROUND_BLUR = Object.freeze({ min: 0, max: 1, step: 0.05 })
export const EXPOSURE = Object.freeze({ min: 0, max: 3, step: 0.05 })
export const GROUND_SIZE = Object.freeze({ min: 1, max: 500, step: 1 })
export const FOG_DENSITY = Object.freeze({ min: 0.001, max: 0.2, step: 0.001 })

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
export type TextureSlot =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'aoMap'
  | 'emissiveMap'
  /**
   * Displaces VERTICES, so it shows nothing on a shape with no vertices to move — a plane of two
   * triangles stays flat however strong the map. The material's own preview tessellates; a scene
   * draws what its geometry has.
   */
  | 'displacementMap'

export const TEXTURE_SLOTS: readonly TextureSlot[] = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'displacementMap',
]

export type MaterialDescriptor = {
  kind: 'standard'
  /** `null` means the studio's own colour, resolved from the palette when the mesh is built. */
  color: string | null
  roughness: number
  metalness: number
  /**
   * How many times the maps repeat per METRE, not across the whole shape: 1 puts one square of
   * the working checker on every square metre, of a forty-metre floor as of a three-metre wall.
   *
   * A count across the shape was the first design and it could not hold — one number over UVs
   * that run 0..1 whatever the face measures gives 1 m per square along a 40 m band and 0,4 m
   * across the 16 m one, so two halves of one floor read as two different textures.
   *
   * Carried by the material and applied to the GEOMETRY's UVs rather than to the texture: the
   * engine shares one `Texture` between every mesh wearing it, so a repeat set there would
   * follow that picture everywhere it is used. Baked UVs also travel as plain glTF, which any
   * reader understands without an extension.
   */
  tilesPerMetre: number
} & { [S in TextureSlot]: TextureRef | null }

/**
 * Bounds the field and a hand-edited file alike — and the reading CLAMPS to them rather than
 * only checking the number is finite: zero collapses every UV onto one texel, which reads as a
 * mesh painted in a single flat colour with no way to tell why.
 */
export const TILES_PER_METRE = Object.freeze({ min: 0.05, max: 20, step: 0.05 })

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
export type ExportFormat = 'glb' | 'gltf' | 'usdz' | 'obj' | 'ply' | 'stl'

export const EXPORT_FORMATS: readonly ExportFormat[] = ['glb', 'gltf', 'usdz', 'obj', 'ply', 'stl']

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
 * What the viewport draws. The order is the order the key cycles through: the three the studio
 * opened with first, then the ones a model is judged by.
 *
 * `solid`, `matcap` and `density` paint every surface with one stand-in material, so what shows
 * is the SHAPE — a matcap reads curvature the way a clay render does, and density says which
 * object of a set carries the triangles. `material` keeps the real materials but drops the
 * scene's own lights, which is how a texture is judged without a light flattering it.
 *
 * `studio` goes one step further and drops the document's ENVIRONMENT too, lighting the subject
 * from three's own prefiltered room: it is the mode that still shows a mesh when the scene it
 * lives in is a night sky with no lamp in it.
 */
export type DisplayMode =
  | 'shaded'
  | 'wireframe'
  | 'both'
  | 'solid'
  | 'material'
  | 'studio'
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
  'studio',
  'matcap',
  'density',
  'ghost',
  'skeleton',
]

export function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.some(mode => mode === value)
}

/**
 * How much of a family of aids is drawn. `selected` is what the studio has always done for lights
 * and camera frustums, and stays the default: a directional light draws a line clear across the
 * scene, so three lamps shown at once is a viewport nobody can read.
 */
export type HelperVisibility = 'off' | 'selected' | 'all'

export const HELPER_VISIBILITIES: readonly HelperVisibility[] = ['off', 'selected', 'all']

/**
 * Whether an aid is drawn for this node. Here rather than beside either of its callers: the
 * viewport draws light helpers and camera frustums, `viewportAids` draws boxes and origins, and
 * the two had the same expression written out twice.
 */
export function showsAid(
  visibility: HelperVisibility,
  selected: ReadonlySet<string>,
  id: string,
): boolean {
  return visibility === 'all' || (visibility === 'selected' && selected.has(id))
}

/**
 * How the viewport spends its pixels. It moves `pixelRatio` and nothing about the assets: a
 * texture is never resized, a geometry never simplified.
 */
export type ViewportQuality = 'performance' | 'balanced' | 'high'

export const VIEWPORT_QUALITIES: readonly ViewportQuality[] = ['performance', 'balanced', 'high']

/**
 * The unit lengths are WRITTEN in. One scene unit is one metre and stays one metre — this changes
 * what a field shows and what it reads back, never what the scene holds.
 */
export type DisplayUnit = 'mm' | 'cm' | 'm'

export const DISPLAY_UNITS: readonly DisplayUnit[] = ['mm', 'cm', 'm']

/** How much of a normal is drawn, relative to the object it stands on. */
export const NORMAL_LENGTH = Object.freeze({ min: 0.01, max: 2, step: 0.01 })
