/**
 * A scene as a saved document writes and reads it.
 *
 * Which fields a descriptor must carry is read off the very tables the inspector derives its
 * controls from, rather than restated as a schema here: a primitive gained or a parameter
 * renamed cannot leave a loader still accepting the shape before it.
 *
 * Only presence and type are checked, never the `min`/`max` those tables also declare — those
 * are what an inspector clamps a *live* edit to, and a document written by an earlier build is
 * allowed to hold a value today's bounds would refuse.
 */
import {
  DEFAULT_CAMERA,
  readEnvironment,
  TEXTURE_SLOTS,
  type EnvironmentRef,
  type Transform,
} from '@shared/domain/scene'
import {
  DEFAULT_DURATION,
  DEFAULT_FPS,
  EMPTY_TIMELINE,
  TRACK_PROPERTIES,
  type AnimationTimeline,
  type AnimationTrack,
  type Keyframe,
} from '@shared/domain/animation'
import { readFontRef } from '@shared/domain/font'
import { isRecord, readNumber } from '@shared/guards'
import {
  GEOMETRY_SPECS,
  LIGHT_SPECS,
  MATERIAL_SPECS,
  SPRITE_SPECS,
  TEXT_SPECS,
  isVector3,
  type PropertySpec,
} from './property-fields'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  DEFAULT_TEXT,
  EMPTY_SCENE,
  shadowDefaults,
  type SceneNode,
  type SceneState,
} from './scene-state'

/** What a saved scene holds. The selection is session state, and is deliberately left out. */
export type ScenePayload = {
  nodes: readonly SceneNode[]
  environment: EnvironmentRef
  animation: AnimationTimeline
}

export function scenePayload(state: SceneState): ScenePayload {
  return { nodes: state.nodes, environment: state.environment, animation: state.animation }
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
  return {
    nodes: nodes.filter(isSceneNode).map(revived),
    selectedIds: [],
    environment: readEnvironment(payload.environment),
    animation: readTimeline(payload.animation),
  }
}

/**
 * A node as the studio holds it, from a node as the file spells it.
 *
 * The typeface is read rather than trusted: a family the studio no longer ships falls back to one
 * it does. A family the machine simply has not got is kept — the document said what it meant, and
 * the engine is what reports that this machine cannot honour it.
 */
function revived(node: SceneNode): SceneNode {
  const filled = { ...node, ...withDefaults(node) }

  // Every descriptor a spec table describes is laid over its default, so a field the table has
  // gained since the file was written arrives with a value instead of `undefined`. `measures`
  // is what lets such a file through in the first place; this is the other half of the same
  // rule, and one without the other would revive a sprite whose opacity is nothing at all.
  if (filled.type === 'mesh') {
    return { ...filled, material: { ...DEFAULT_MATERIAL, ...filled.material } }
  }
  if (filled.type === 'sprite') {
    return { ...filled, sprite: { ...DEFAULT_SPRITE, ...filled.sprite } }
  }
  if (filled.type === 'camera') {
    return { ...filled, camera: { ...DEFAULT_CAMERA, ...filled.camera } }
  }
  if (filled.type !== 'text') return filled

  return {
    ...filled,
    material: { ...DEFAULT_MATERIAL, ...filled.material },
    text: { ...DEFAULT_TEXT, ...filled.text, font: readFontRef(filled.text.font) },
  }
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
    return describes(value.geometry, GEOMETRY_SPECS) && isMaterial(value.material)
  }
  // A model is a reference and nothing else: an absent or non-string `assetId` costs the node,
  // never the file. What it points at is resolved when the scene is built, not here — a project
  // whose assets moved still opens, with a hole where the model was.
  if (value.type === 'model')
    return (
      isRecord(value.model) &&
      typeof value.model.assetId === 'string' &&
      isOptionalAnimation(value.model.animation) &&
      isOptionalTextureOverrides(value.model.textures)
    )
  // A sprite is its colour, its opacity and at most one map — the same shapes as a material's,
  // checked against the same table.
  if (value.type === 'sprite') return isSprite(value.sprite)
  // A text is words, a face and three numbers, wearing a material like a mesh does.
  if (value.type === 'text') return isText(value.text) && isMaterial(value.material)
  // A group carries nothing of its own: everything it is has already been checked above.
  if (value.type === 'group') return true
  // Three numbers, and a file that holds none of them keeps its node: the defaults are what a
  // camera is without them, and `revived` lays them under whatever the file did say.
  if (value.type === 'camera') return value.camera === undefined || isRecord(value.camera)

  return value.type === 'light' && describes(value.light, LIGHT_SPECS)
}

function isOptionalFlag(value: unknown): boolean {
  return value == null || typeof value === 'boolean'
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

  return TEXTURE_SLOTS.every(slot => value[slot] === undefined || isTextureRef(value[slot]))
}

/**
 * The timeline a file holds, or an empty one. Read track by track rather than refused whole, on
 * the rule the nodes already follow: a project folder is user territory, and one malformed track
 * must not cost the animation around it.
 */
function readTimeline(value: unknown): AnimationTimeline {
  if (!isRecord(value)) return EMPTY_TIMELINE

  const tracks = Array.isArray(value.tracks) ? value.tracks.filter(isTrack) : []
  // `readNumber` gives the fallback for anything that is not a finite number; zero and below are
  // finite and still meaningless here, so the positive test stays.
  const duration = readNumber(value, 'duration', DEFAULT_DURATION)
  const fps = readNumber(value, 'fps', DEFAULT_FPS)

  return {
    duration: duration > 0 ? duration : DEFAULT_DURATION,
    fps: fps > 0 ? fps : DEFAULT_FPS,
    tracks,
  }
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

  return Array.isArray(value.keys) && value.keys.every(isKeyframe)
}

function isKeyframe(value: unknown): value is Keyframe {
  return isRecord(value) && Number.isFinite(value.time) && isVector3(value.value)
}

function isTransform(value: unknown): value is Transform {
  if (!isRecord(value)) return false
  return isVector3(value.position) && isVector3(value.rotation) && isVector3(value.scale)
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
