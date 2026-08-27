/**
 * A scene as a saved document writes and reads it.
 *
 * Which fields a descriptor must carry is read off the very tables the inspector derives its
 * controls from, rather than restated as a schema here: a primitive gained or a parameter
 * renamed cannot leave a loader still accepting the shape before it.
 *
 * ACCEPTING a value is separate from KEEPING it. Only presence and type decide whether a node is
 * read at all — never the `min`/`max` those tables also declare, since a document written by an
 * earlier build is allowed to hold a value today's bounds would refuse, and dropping the node
 * would lose it in silence. What `revived` does afterwards is the other question: one field is
 * clamped there, and it says why.
 */
import {
  clipFromAnimation,
  clipLane,
  DEFAULT_CAMERA,
  DEFAULT_PATH,
  MAIN_LANE_ID,
  isTransform,
  isVector3,
  ROOT_MOTIONS,
  TEXTURE_SLOTS,
  TILES_PER_METRE,
  type MaterialDescriptor,
  type ModelRef,
  type SceneWorld,
} from '@shared/domain/scene'
import { CSG_OPERATIONS, type CsgPart } from '@shared/domain/csg'
import { readWorld } from './sceneWorld'
import { BODY_PARTS } from '@shared/domain/humanoid'
import { isRig } from '@shared/domain/rig'
import {
  DEFAULT_DURATION,
  DEFAULT_FPS,
  EASINGS,
  EMPTY_TIMELINE,
  SCENE_SUBJECT_ID,
  sheetFromAnimated,
  TIMELINE_TEMPLATES,
  TRACK_PROPERTIES,
  TRANSITION_KINDS,
  type AnimationTimeline,
  type AnimationTrack,
  type CameraShot,
  type Keyframe,
  type TimelineEvent,
  type TimelineMedia,
  type TimelineTemplate,
  type TimelineTransition,
  type TransitionKind,
} from '@shared/domain/animation'
import { readFontRef } from '@shared/domain/font'
import { readCameraPost } from '@shared/domain/postProcessing'
import { isRecord, readNumber } from '@shared/guards'
import type { Component } from '@shared/domain/component'
import { isComponentType } from '@shared/domain/componentRegistry'
import { newId } from '@/helpers/ids'
import { clamp } from '@shared/numeric'
import {
  GEOMETRY_SPECS,
  LIGHT_SPECS,
  MATERIAL_SPECS,
  SPRITE_SPECS,
  TEXT_SPECS,
  type PropertySpec,
} from './propertyFields'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  DEFAULT_TEXT,
  EMPTY_SCENE,
  shadowDefaults,
  type SceneNode,
  type SceneState,
} from './sceneState'

/** What a saved scene holds. The selection is session state, and is deliberately left out. */
export type ScenePayload = {
  nodes: readonly SceneNode[]
  world: SceneWorld
  animation: AnimationTimeline
}

export function scenePayload(state: SceneState): ScenePayload {
  // The scene's own composition line stands beside the nodes, never among them: without it here
  // a save would quietly drop `@scene` from the sheet, and the composition would lose its line.
  const alive = new Set([...state.nodes.map(node => node.id), SCENE_SUBJECT_ID])
  const sheet = state.animation.sheet.filter(id => alive.has(id))

  return {
    nodes: state.nodes,
    world: state.world,
    // The sheet WITHOUT the objects the scene has lost. Deleting one leaves its id behind on
    // purpose — an undo then gives the object its line back — but writing it would let a file
    // gather ghosts nobody ever clears, one per object ever deleted.
    animation:
      sheet.length === state.animation.sheet.length
        ? state.animation
        : { ...state.animation, sheet },
  }
}

/**
 * The scene a document's payload describes, keeping the nodes it fully describes and dropping
 * the rest.
 *
 * A project folder is user territory: a file can be hand-edited, truncated, or synced back half
 * written. Dropping what no longer parses shows the rest of the scene; refusing the file whole
 * would show nothing, and a scene of ninety-nine good meshes is not lost to one bad one.
 */
export function sceneFromPayload(payload: unknown): SceneState {
  if (!isRecord(payload) || !Array.isArray(payload.nodes)) return EMPTY_SCENE

  const nodes: readonly unknown[] = payload.nodes
  /**
   * Defaults first, the node on top: a flag the file does not hold keeps its default, one it
   * holds wins. That ordering *is* the migration — every document written so far predates
   * shadows, and requiring the flags would have emptied each of them at load, silently, since a
   * dropped node looks exactly like one that was never there.
   */
  const kept = nodes.filter(isSceneNode).map(revived)

  return {
    nodes: kept,
    selectedIds: [],
    // The root `environment` is where the sky lived before the world existed — see `readWorld`.
    world: readWorld(payload.world, payload.environment),
    animation: readTimeline(payload.animation, kept),
  }
}

/** The models whose lane actually carries a clip — see `sheetFromAnimated`. */
function playingModels(nodes: readonly SceneNode[]): string[] {
  return nodes.flatMap(node =>
    node.type === 'model' && (node.model.lanes ?? []).some(lane => lane.clips.length > 0)
      ? node.id
      : [],
  )
}

/**
 * A node as the studio holds it, from a node as the file spells it.
 *
 * The typeface is read rather than trusted: a family the studio no longer ships falls back to one
 * it does. A family the machine simply has not got is kept — the document said what it meant, and
 * the engine is what reports that this machine cannot honour it.
 */
function revived(node: SceneNode): SceneNode {
  const filled = { ...withComponentsRead(node), ...withDefaults(node) }

  // Every descriptor a spec table describes is laid over its default, so a field the table has
  // gained since the file was written arrives with a value instead of `undefined`. `measures`
  // is what lets such a file through in the first place; this is the other half of the same
  // rule, and one without the other would revive a sprite whose opacity is nothing at all.
  if (filled.type === 'mesh') {
    return { ...filled, material: revivedMaterial(filled.material) }
  }
  if (filled.type === 'carved') {
    const material = revivedMaterial(filled.material)
    // A brush written before it kept its own material takes the solid's, so `separateNode`
    // always hands back something painted rather than a hole in the descriptor.
    const painted = (part: CsgPart): CsgPart => ({
      ...part,
      material: revivedMaterial(part.material ?? material),
    })

    return {
      ...filled,
      material,
      carved: {
        ...filled.carved,
        base: painted(filled.carved.base),
        steps: filled.carved.steps.map(step => ({ ...step, part: painted(step.part) })),
      },
    }
  }
  if (filled.type === 'sprite') {
    return { ...filled, sprite: { ...DEFAULT_SPRITE, ...filled.sprite } }
  }
  if (filled.type === 'camera') {
    const { post, ...lens } = { ...DEFAULT_CAMERA, ...filled.camera }
    const read = readCameraPost(post, newId)
    // `inherit` is what an ABSENT field already means, so it is not written back: a camera that
    // follows the scene reads the same in a file written before compositions existed.
    return { ...filled, camera: read.mode === 'inherit' ? lens : { ...lens, post: read } }
  }
  if (filled.type === 'model') {
    return { ...filled, model: withDress(withLanes(filled.model)) }
  }
  if (filled.type === 'path') {
    return { ...filled, path: { ...DEFAULT_PATH, ...filled.path } }
  }
  if (filled.type !== 'text') return filled

  return {
    ...filled,
    material: revivedMaterial(filled.material),
    text: { ...DEFAULT_TEXT, ...filled.text, font: readFontRef(filled.text.font) },
  }
}

/**
 * The components the studio can act on, and only those.
 *
 * A type this build does not know is dropped from the STATE — nothing would simulate it and no
 * form could show it — and `sceneHoldsMore` then refuses to save the file over it, exactly as it
 * refuses a glTF extension we do not write. Dropping and saving would lose an author's work in
 * silence; refusing says so.
 *
 * An untouched node comes back untouched: a document written before components existed keeps no
 * key, so it saves back byte for byte.
 */
function withComponentsRead(node: SceneNode): SceneNode {
  if (node.components === undefined) return node

  const raw: unknown = node.components
  return { ...node, components: Array.isArray(raw) ? raw.filter(isKnownComponent) : [] }
}

const isKnownComponent = (value: unknown): value is Component =>
  isRecord(value) && isComponentType(value.type)

/**
 * A material over its defaults, with its tiling held inside the bounds the field offers.
 *
 * CLAMPED rather than refused: `isMaterial` accepts any finite number, and tightening it there
 * would drop the whole node in silence — a mesh gone is worse than a mesh tiled oddly. Zero is
 * the case that matters, and it collapses every UV onto one texel.
 */
function revivedMaterial(material: MaterialDescriptor): MaterialDescriptor {
  const filled = { ...DEFAULT_MATERIAL, ...material }

  return {
    ...filled,
    tilesPerMetre: clamp(filled.tilesPerMetre, TILES_PER_METRE.min, TILES_PER_METRE.max),
  }
}

/**
 * A model's lanes, from whichever of the three forms the file spells. The two older ones are READ
 * and never written again — dropping either would lose the animation of every scene saved so far,
 * and a node that plays nothing looks exactly like one that never played.
 */
function withLanes(model: ModelRef): ModelRef {
  if (model.lanes) return model

  const clips = model.clips ?? (model.animation ? [clipFromAnimation(model.animation)] : null)
  if (!clips) return model

  const next = { ...model, lanes: [clipLane(MAIN_LANE_ID, clips)] }
  delete next.clips
  delete next.animation
  return next
}

/**
 * A model's dress, folding the single material id every document written before the two modes
 * existed spells. Read and never written again — dropping it would undress every model already
 * saved, and a model back in its file's own material looks exactly like one never dressed.
 */
function withDress(model: ModelRef): ModelRef {
  if (model.dress || !model.materialDocumentId) return model

  const next: ModelRef = {
    ...model,
    dress: { kind: 'materials', documentIds: [model.materialDocumentId] },
  }
  delete next.materialDocumentId
  return next
}

/** The flags, filled in where the file holds none — `null` included. */
function withDefaults(node: SceneNode): Pick<SceneNode, 'castShadow' | 'receiveShadow'> {
  const defaults = shadowDefaults(node)
  return {
    castShadow: node.castShadow ?? defaults.castShadow,
    receiveShadow: node.receiveShadow ?? defaults.receiveShadow,
  }
}

/** Keyed by kind rather than by shape, which is what makes an unknown kind a refusal. */
type SpecTable = Record<string, Record<string, PropertySpec> | undefined>

/** The colour is checked apart: `null` is legal for it, and for nothing else. */
const MEASURED_MATERIAL = Object.entries(MATERIAL_SPECS).filter(([name]) => name !== 'color')

/** Same, for a sprite: derived from the table so a field added to it cannot go unchecked. */
const MEASURED_SPRITE = Object.entries(SPRITE_SPECS).filter(([name]) => name !== 'color')

function isSceneNode(value: unknown): value is SceneNode {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || value.id === '') return false
  if (value.parentId !== null && typeof value.parentId !== 'string') return false
  if (typeof value.name !== 'string' || typeof value.visible !== 'boolean') return false
  if (!isTransform(value.transform)) return false
  // Absent is legal and means "the default", filled in below. `null` counts as absent: a tool
  // that serializes missing fields that way must not cost the node.
  if (!isOptionalFlag(value.castShadow) || !isOptionalFlag(value.receiveShadow)) return false

  if (value.type === 'mesh') {
    return (
      describes(value.geometry, GEOMETRY_SPECS) &&
      isMaterial(value.material) &&
      isOptionalFlag(value.negative)
    )
  }
  // A model is a reference and nothing else: an absent or non-string `assetId` costs the node,
  // never the file. What it points at is resolved when the scene is built, not here — a project
  // whose assets moved still opens, with a hole where the model was.
  if (value.type === 'model')
    return (
      isRecord(value.model) &&
      typeof value.model.assetId === 'string' &&
      isOptionalAnimation(value.model.animation) &&
      isOptionalClips(value.model.clips) &&
      isOptionalLanes(value.model.lanes) &&
      isOptionalRig(value.model.rig) &&
      isOptionalTextureOverrides(value.model.textures) &&
      isOptionalDress(value.model.dress) &&
      // A document id, never resolved here: the material may have been deleted, and a scene that
      // still opens with a model wearing its file's own maps is better than one that will not.
      (value.model.materialDocumentId === undefined ||
        typeof value.model.materialDocumentId === 'string')
    )
  // A sprite is its colour, its opacity and at most one map — the same shapes as a material's,
  // checked against the same table.
  if (value.type === 'sprite') return isSprite(value.sprite)
  // A text is words, a face and three numbers, wearing a material like a mesh does.
  if (value.type === 'text') return isText(value.text) && isMaterial(value.material)
  // A group carries nothing of its own: everything it is has already been checked above.
  if (value.type === 'group') return true
  // The recipe, and the material it wears like a mesh. A graph that does not read is the node
  // refused rather than a solid drawn from half a recipe — glTF being index-bound, half a graph
  // is a broken file, not a partly right one.
  if (value.type === 'carved')
    return isCsgGraph(value.carved) && isMaterial(value.material) && isOptionalFlag(value.negative)
  // Three numbers, and a file that holds none of them keeps its node: the defaults are what a
  // camera is without them, and `revived` lays them under whatever the file did say.
  if (value.type === 'camera') return value.camera === undefined || isRecord(value.camera)
  // A rail is its points, and a curve through fewer than two is a point with a name — refused
  // like a model with no asset, so the rest of the scene still opens.
  if (value.type === 'path') return isPath(value.path)

  return value.type === 'light' && describes(value.light, LIGHT_SPECS)
}

/**
 * A boolean recipe: one base brush, then any number of steps. The shapes go through the very
 * table a mesh's does, so a primitive gained is accepted here the day it is offered on screen.
 */
function isCsgGraph(value: unknown): boolean {
  if (!isRecord(value) || !isCsgPart(value.base)) return false
  if (!Array.isArray(value.steps)) return false

  return value.steps.every(
    step =>
      isRecord(step) && CSG_OPERATIONS.some(one => one === step.operation) && isCsgPart(step.part),
  )
}

function isCsgPart(value: unknown): boolean {
  if (!isRecord(value) || typeof value.name !== 'string') return false
  if (!isTransform(value.transform)) return false
  // A shape, or a whole recipe: a solid folded into another solid nests here, and the check
  // walks down with it. `base` is what a graph has and a descriptor never does.
  const shape = value.geometry
  const nested = isRecord(shape) && 'base' in shape
  if (!(nested ? isCsgGraph(shape) : describes(shape, GEOMETRY_SPECS))) return false
  // Absent on a document written before a brush kept its own: the solid's material is laid under
  // it in `revived`, which is what a separate then hands back.
  return value.material === undefined || isMaterial(value.material)
}

function isOptionalFlag(value: unknown): boolean {
  return value == null || typeof value === 'boolean'
}

/** Its points and its shape. `closed` and `tension` absent mean the defaults `revived` lays in. */
function isPath(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.points)) return false
  if (value.points.length < 2 || !value.points.every(isVector3)) return false

  return isOptionalFlag(value.closed) && (value.tension == null || Number.isFinite(value.tension))
}

/**
 * Absent is legal and means "still", as for the two older forms below: a document written before
 * lanes existed holds none, and `revived` is what folds what it does hold into one.
 */
function isOptionalLanes(value: unknown): boolean {
  if (value == null) return true

  return Array.isArray(value) && value.every(isLane)
}

function isLane(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string') return false

  return Array.isArray(value.clips) && value.clips.every(isClip)
}

/**
 * Absent is legal and means "still", exactly as for the singular below: a document written before
 * clips were plural holds none, and `revived` is what turns the one it does hold into a list.
 */
function isOptionalClips(value: unknown): boolean {
  if (value == null) return true

  return Array.isArray(value) && value.every(isClip)
}

function isClip(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || typeof value.label !== 'string') return false
  if (!isClipSource(value.source)) return false
  // `playing` is NOT required, and a document written while it was still a field must keep
  // passing: it is session state now, so an extra boolean in the file is simply ignored.
  if (typeof value.loop !== 'boolean') return false
  if (!ROOT_MOTIONS.some(motion => motion === value.rootMotion)) return false
  // Absent is legal and means the whole body: every document written before the halves existed.
  if (value.part != null && !BODY_PARTS.some(part => part === value.part)) return false

  return ['start', 'duration', 'offset', 'speed', 'fadeIn', 'fadeOut'].every(field =>
    Number.isFinite(value[field]),
  )
}

function isClipSource(value: unknown): boolean {
  if (!isRecord(value) || typeof value.name !== 'string') return false
  if (value.kind === 'embedded' || value.kind === 'bundled') return true

  return value.kind === 'asset' && typeof value.assetId === 'string' && value.assetId !== ''
}

/** The invariants live with the type: one parent per bone, no cycle, no role twice. */
function isOptionalRig(value: unknown): boolean {
  return value == null || isRig(value)
}

/**
 * Absent is legal and means "still": every document written before animation existed says
 * nothing here. A record that is there but malformed costs the node, like every other field —
 * a file that says nothing is not a file that says wrong.
 */
function isOptionalAnimation(value: unknown): boolean {
  if (value == null) return true
  if (!isRecord(value)) return false

  return (
    typeof value.clip === 'string' &&
    typeof value.playing === 'boolean' &&
    typeof value.loop === 'boolean' &&
    Number.isFinite(value.time) &&
    Number.isFinite(value.speed)
  )
}

/**
 * The maps put over the ones a model's file carries. Absent is legal and means "the file's own",
 * which is what every document written before overriding existed says.
 *
 * A slot spelled with something that is not a reference costs the node, exactly as a malformed
 * animation does: the alternative is a model coming back with one map silently missing.
 */
function isOptionalTextureOverrides(value: unknown): boolean {
  if (value == null) return true
  if (!isRecord(value)) return false

  // `null` is refused where a material's own slots take it: there, `null` means « no map », and
  // here « the file's own » is what an ABSENT slot already says. Accepting it would load a state
  // its own type forbids, and one `setModelTextures` never empties — the dead field would be
  // written back on every save.
  return TEXTURE_SLOTS.every(
    slot => value[slot] === undefined || (value[slot] !== null && isTextureRef(value[slot])),
  )
}

/**
 * What covers a model, or nothing. A dress spelling NEITHER kind costs the node rather than being
 * dropped to nothing: its author meant something this reader cannot name, and silently undressing
 * the model would hide that.
 */
function isOptionalDress(value: unknown): boolean {
  if (value == null) return true
  if (!isRecord(value)) return false

  if (value.kind === 'image') return typeof value.assetId === 'string'

  return (
    value.kind === 'materials' &&
    Array.isArray(value.documentIds) &&
    value.documentIds.every(id => typeof id === 'string')
  )
}

/**
 * The timeline a file holds, or an empty one. Read track by track rather than refused whole, on
 * the rule the nodes already follow: a project folder is user territory, and one malformed track
 * must not cost the animation around it.
 */
function readTimeline(value: unknown, nodes: readonly SceneNode[]): AnimationTimeline {
  if (!isRecord(value)) return EMPTY_TIMELINE

  const tracks = Array.isArray(value.tracks) ? value.tracks.filter(isTrack) : []
  const shots = shotsInOrder(Array.isArray(value.shots) ? value.shots.filter(isShot) : [])
  // `readNumber` gives the fallback for anything that is not a finite number; zero and below are
  // finite and still meaningless here, so the positive test stays.
  const duration = readNumber(value, 'duration', DEFAULT_DURATION)
  const fps = readNumber(value, 'fps', DEFAULT_FPS)

  // 🛑 Read back or LOST: a save recomposes the timeline whole from the state, so a row this
  // build does not read is a row the next `⌘S` drops without a word — see `sceneHoldsMore`,
  // which is what tells a reader before it happens.
  const events = readList(value.events, isTimelineEvent)
  const audio = readList(value.audio, isTimelineMedia)
  const video = readList(value.video, isTimelineMedia)
  const transitions = readList(value.transitions, isTimelineTransition)

  return {
    duration: duration > 0 ? duration : DEFAULT_DURATION,
    fps: fps > 0 ? fps : DEFAULT_FPS,
    tracks,
    shots,
    sheet: readSheet(value.sheet, tracks, shots, playingModels(nodes)),
    // Absent rather than empty: a document that never had one must come back as it was written,
    // and `document.test.ts` compares what a round trip gives back.
    ...(events.length > 0 ? { events } : {}),
    ...(audio.length > 0 ? { audio } : {}),
    ...(video.length > 0 ? { video } : {}),
    ...(transitions.length > 0 ? { transitions } : {}),
    ...(isTimelineTemplate(value.template) ? { template: value.template } : {}),
  }
}

/** Whatever of a list this build can read, in order. Anything else is dropped, and SAID. */
const readList = <T>(value: unknown, holds: (one: unknown) => one is T): T[] =>
  Array.isArray(value) ? value.filter(holds) : []

const isTimelineEvent = (value: unknown): value is TimelineEvent =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.at === 'number' &&
  typeof value.name === 'string'

const isTimelineMedia = (value: unknown): value is TimelineMedia =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.assetId === 'string' &&
  typeof value.start === 'number' &&
  typeof value.duration === 'number'

const isTimelineTransition = (value: unknown): value is TimelineTransition =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.at === 'number' &&
  typeof value.duration === 'number' &&
  TRANSITION_KINDS.includes(value.kind as TransitionKind)

const isTimelineTemplate = (value: unknown): value is TimelineTemplate =>
  typeof value === 'string' && TIMELINE_TEMPLATES.includes(value as TimelineTemplate)

/**
 * Which objects the band shows. Without one, rebuilt ONCE from what is animated — a file written
 * before sheets existed would come back with its animated objects nowhere to be seen. WITH one,
 * taken as it stands, empty included: rebuilding would put back what someone removed on purpose.
 */
function readSheet(
  value: unknown,
  tracks: readonly AnimationTrack[],
  shots: readonly CameraShot[],
  playing: readonly string[],
): string[] {
  if (Array.isArray(value)) return value.filter(id => typeof id === 'string')
  return sheetFromAnimated(tracks, shots, playing)
}

/**
 * The shots in the order that settles an overlap, which is the list's own — see `activeShotAt`.
 *
 * A document written while `layer` existed is sorted by it ONCE, here, highest first and equal
 * layers by start, which is exactly the law those numbers used to spell. Read any later and the
 * field would have to survive for good; the shots go back out without it.
 */
function shotsInOrder(shots: readonly CameraShot[]): CameraShot[] {
  // Widened rather than kept in `CameraShot`: the field is on disk, and declaring it would make
  // every writer go on filling a number nothing reads.
  const written = shots as readonly (CameraShot & { layer?: number })[]

  // Only a file that HELD layers is re-sorted. Without this the comparator would fall through to
  // `start` on every document written since, undoing on each read the stack the user arranged.
  if (!written.some(shot => typeof shot.layer === 'number')) return [...written]

  return [...written]
    .sort((left, right) => (right.layer ?? 0) - (left.layer ?? 0) || left.start - right.start)
    .map(({ layer: _, ...kept }) => kept)
}

/**
 * Whether a shot is one. Its shape only: whether the camera it names still exists is a question
 * about the scene at an instant, and `activeShotAt` is the one place that asks it.
 */
function isShot(value: unknown): value is CameraShot {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || value.id === '') return false
  if (typeof value.cameraId !== 'string' || value.cameraId === '') return false
  if (!Number.isFinite(value.start)) return false
  if (!isOptionalMotion(value.motion) || !isOptionalTarget(value.target)) return false
  // A shot of no length covers no instant at all, so it could only ever be a hole in the band.
  return typeof value.duration === 'number' && value.duration > 0
}

/** Absent means a shot that does not move. A rail it names but the scene has lost is skipped
 * by `railCamera` rather than refused here — the same rule shots follow for their camera. */
function isOptionalMotion(value: unknown): boolean {
  if (value == null) return true
  if (!isRecord(value)) return false

  return (
    typeof value.pathId === 'string' &&
    EASINGS.some(easing => easing === value.easing) &&
    Number.isFinite(value.from) &&
    Number.isFinite(value.to)
  )
}

/** Absent means FREE: the camera is aimed by its own rotation and nothing else. */
function isOptionalTarget(value: unknown): boolean {
  if (value == null) return true
  if (!isRecord(value)) return false

  if (value.kind === 'point') return isVector3(value.at)
  return value.kind === 'node' && typeof value.nodeId === 'string'
}

function isTrack(value: unknown): value is AnimationTrack {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || value.id === '') return false
  if (typeof value.name !== 'string') return false
  if (!Number.isFinite(value.index)) return false
  const target = value.target
  if (!isRecord(target)) return false
  if (typeof target.nodeId !== 'string') return false
  if (target.bone !== undefined && typeof target.bone !== 'string') return false
  if (!TRACK_PROPERTIES.some(property => property === target.property)) return false
  // A composition channel that names no effect and no parameter drives nothing: kept, it would
  // sit on the sheet as a row whose keys reach nowhere.
  if (target.property === 'post' && !isPostTarget(target.post)) return false

  return Array.isArray(value.keys) && value.keys.every(isKeyframe)
}

function isPostTarget(value: unknown): boolean {
  return isRecord(value) && typeof value.effectId === 'string' && typeof value.param === 'string'
}

function isKeyframe(value: unknown): value is Keyframe {
  return isRecord(value) && Number.isFinite(value.time) && isVector3(value.value)
}

/**
 * A descriptor is what its `kind` names when every field that kind declares is there, and of the
 * type its control implies.
 */
function describes(value: unknown, table: SpecTable): boolean {
  if (!isRecord(value) || typeof value.kind !== 'string') return false

  const fields = table[value.kind]
  if (!fields) return false

  return Object.entries(fields).every(([name, spec]) => matches(value[name], spec))
}

/**
 * A field the table describes, or absent — and absent means the default, which `revived` fills.
 *
 * This is what keeps a field ADDED to a spec table from deleting the node out of every document
 * written before it existed. The tables are exhaustive by typecheck, so a new field is required
 * of files that could not have carried it the moment it lands, and a node that fails its guard
 * is dropped in silence — indistinguishable from a node that never existed.
 *
 * Only `undefined`, never `null`: the colour and the texture slots read `null` as a value of
 * their own, and a number stored as `null` is a file saying something wrong rather than saying
 * nothing.
 */
function measures(value: unknown, spec: PropertySpec): boolean {
  return value === undefined || matches(value, spec)
}

function matches(value: unknown, spec: PropertySpec): boolean {
  if (spec.control === 'color') return typeof value === 'string'
  if (spec.control === 'vector3') return isVector3(value)
  // `Number.isFinite`, not `typeof`: JSON has no NaN, but `1e999` parses to Infinity, and a
  // geometry built from one produces vertices the raycaster then never hits.
  return Number.isFinite(value)
}

function isMaterial(value: unknown): boolean {
  if (!isRecord(value) || value.kind !== 'standard') return false
  // `null` means the studio's own colour, resolved when the mesh is built.
  if (value.color !== null && typeof value.color !== 'string') return false
  if (!MEASURED_MATERIAL.every(([name, spec]) => measures(value[name], spec))) return false

  // A slot added to `TEXTURE_SLOTS` is the same trap as a field added to a table, and the
  // default it revives with — no texture — is the one absence already means.
  return TEXTURE_SLOTS.every(slot => value[slot] === undefined || isTextureRef(value[slot]))
}

function isSprite(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.color !== null && typeof value.color !== 'string') return false
  if (!MEASURED_SPRITE.every(([name, spec]) => measures(value[name], spec))) return false

  return value.map === undefined || isTextureRef(value.map)
}

/**
 * The face is read rather than checked: `readFontRef` falls back on one the studio ships, so a
 * document naming a family nothing can answer still opens — with plain letters, and a line in the
 * log — instead of losing the node whole.
 */
function isText(value: unknown): boolean {
  if (!isRecord(value) || typeof value.value !== 'string') return false

  return Object.entries(TEXT_SPECS).every(([name, spec]) => measures(value[name], spec))
}

function isTextureRef(value: unknown): boolean {
  if (value === null) return true
  return isRecord(value) && typeof value.assetId === 'string'
}
