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
  readEnvironment,
  TEXTURE_SLOTS,
  type EnvironmentRef,
  type Transform,
} from '@shared/domain/scene'
import { readFontRef } from '@shared/domain/font'
import { isRecord } from '@shared/guards'
import {
  GEOMETRY_SPECS,
  LIGHT_SPECS,
  MATERIAL_SPECS,
  SPRITE_SPECS,
  TEXT_SPECS,
  isVector3,
  type PropertySpec,
} from './property-fields'
import { EMPTY_SCENE, shadowDefaults, type SceneNode, type SceneState } from './scene-state'

/** What a saved scene holds. The selection is session state, and is deliberately left out. */
export type ScenePayload = { nodes: readonly SceneNode[]; environment: EnvironmentRef }

export function scenePayload(state: SceneState): ScenePayload {
  return { nodes: state.nodes, environment: state.environment }
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
  if (filled.type !== 'text') return filled

  return { ...filled, text: { ...filled.text, font: readFontRef(filled.text.font) } }
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
    return isRecord(value.model) && typeof value.model.assetId === 'string'
  // A sprite is its colour, its opacity and at most one map — the same shapes as a material's,
  // checked against the same table.
  if (value.type === 'sprite') return isSprite(value.sprite)
  // A text is words, a face and three numbers, wearing a material like a mesh does.
  if (value.type === 'text') return isText(value.text) && isMaterial(value.material)
  // A group carries nothing of its own: everything it is has already been checked above.
  if (value.type === 'group') return true

  return value.type === 'light' && describes(value.light, LIGHT_SPECS)
}

function isOptionalFlag(value: unknown): boolean {
  return value == null || typeof value === 'boolean'
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
  if (!MEASURED_MATERIAL.every(([name, spec]) => matches(value[name], spec))) return false

  return TEXTURE_SLOTS.every(slot => isTextureRef(value[slot]))
}

function isSprite(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.color !== null && typeof value.color !== 'string') return false
  if (!MEASURED_SPRITE.every(([name, spec]) => matches(value[name], spec))) return false

  return isTextureRef(value.map)
}

/**
 * The face is read rather than checked: `readFontRef` falls back on one the studio ships, so a
 * document naming a family nothing can answer still opens — with plain letters, and a line in the
 * log — instead of losing the node whole.
 */
function isText(value: unknown): boolean {
  if (!isRecord(value) || typeof value.value !== 'string') return false

  return Object.entries(TEXT_SPECS).every(([name, spec]) => matches(value[name], spec))
}

function isTextureRef(value: unknown): boolean {
  if (value === null) return true
  return isRecord(value) && typeof value.assetId === 'string'
}
