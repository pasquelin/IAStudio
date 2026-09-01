import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { Target } from '@shared/domain/target'
import { readColor } from '@shared/domain/color'
import { FONT_SOURCES, type FontRef } from '@shared/domain/font'
import {
  BACKGROUND_KINDS,
  DISPLAY_MODES,
  FOG_KINDS,
  MATERIAL_SLOTS,
  TONE_MAPPINGS,
  VIEW_DIRECTIONS,
  type MaterialDescriptor,
  type PathDescriptor,
  DEFAULT_WORLD,
  type SceneWorld,
  type SpriteDescriptor,
  type TextDescriptor,
  type TextureSlot,
  type Vector3,
} from '@shared/domain/scene'
import { primitiveByKind } from '@/engines/scene/meshPrimitives'
import { DEFAULT_MATERIAL } from '@/engines/scene/sceneState'
import type { AnimationTimeline as SceneAnimation } from '@shared/domain/animation'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import { movedParts, type Transform } from '@shared/domain/transform'
import { CSG_OPERATIONS } from '@shared/domain/csg'
import { CAPTURE_QUALITIES, DEFAULT_CAPTURE_QUALITY } from '@shared/domain/sceneCapture'
import { SECOND } from '@shared/domain/time'
import { withinBounds } from '@shared/numeric'
import { captureSceneView } from '@/helpers/captureSceneView'
import { canNegate } from '@/engines/csg/carve'
import { ENVIRONMENT_PRESETS, presetPatch } from '@/engines/scene/environmentPresets'
import {
  addNode,
  carveNodes,
  invertCarve,
  multi,
  removeNode,
  renameNode,
  reorderNodes,
  reparentNode,
  setCamera,
  setGeometry,
  setLight,
  setMaterialOn,
  dressModel,
  wearMaterialAt,
  setNodeVisible,
  setPath,
  setNodesNegative,
  setSelection,
  setShadowOn,
  setSpriteOn,
  setTextOn,
  setWorld,
  separateNode,
} from '@/engines/scene/commands'
import { carriesMaterial } from '@/engines/scene/sceneState'
import { backgroundOfKind, fogOfKind } from '@/engines/scene/sceneWorld'
import { EASINGS, POINT_TARGET, type CameraShot } from '@shared/domain/animation'
import {
  addCameraShot,
  bindRailToShot,
  editCameraShot,
  lensToCommand,
  movesToCommand,
  railForShot,
  reorderCameraShots,
} from '@/engines/scene/animationCommands'
import {
  withMovedPoint,
  withPointAfter,
  withPointAppended,
  withPointAtEnd,
  withoutPoint,
} from '@/engines/scene/cameraPath'
import { poseAt } from '@/engines/scene/animationEval'
import { newShotAt, shotsWithCameraMoved } from '@/engines/scene/cameraShots'
import {
  CAMERA_SPECS,
  GEOMETRY_SPECS,
  LIGHT_SPECS,
  withField,
  type PropertySpec,
} from '@/engines/scene/propertyFields'
import { numericBoundsOf } from '@shared/domain/propertySpec'
import { newId } from '@/helpers/ids'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import type { Command } from '@/engines/core/history'
import { createNodeOf, modelNode } from '@/engines/scene/nodeFactory'
import {
  canCastShadow,
  canReceiveShadow,
  canReparent,
  nodeById,
  type SceneNode,
  type SceneState,
} from '@/engines/scene/sceneState'
import { activeSceneId, documentNamedOfKind, useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { MAIN_SCENE_PANE, useSceneViews } from '@/stores/sceneViews'
import { sceneOf, useScenes } from '@/stores/scenes'
import { withAsset, type ActionHandlers } from './actionHandler'
import { nodeAimed } from './nodeAimed'
import { environmentFromInput } from './environmentInput'
import {
  boolOf,
  composedNumber,
  maybeBoolOf,
  numberOf,
  oneOf,
  recordOf,
  textOf,
  textsOf,
} from './actionInputs'

/**
 * The scene graph, driven by value.
 *
 * Every node enters through `createNodeOf`, the factory the Add menu and the native menu go
 * through — a second way of building a box is a second set of defaults to keep in step.
 */

/** What a caller does about it, spelled once for every site that answers `wrongSurface` for want
 * of a scene — five modules of this folder read it. */
export const NO_SCENE =
  'the document in front is no scene — documents.list answers what is open and of which kind, and ' +
  'document.activate brings a scene forward'

/** The scene in front and its state, or nothing — which reads as `wrongSurface`. */
export function mounted(): { documentId: string; state: SceneState } | null {
  const documentId = activeSceneId(useDocuments.getState())
  return documentId === null
    ? null
    : { documentId, state: sceneOf(useScenes.getState(), documentId) }
}

function edit(build: () => Command<SceneState>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  useScenes.getState().runCommand(open.documentId, build())
  return { ok: true }
}

/**
 * The same, for one named node, found before anything runs — a command whose node is gone
 * answers by returning the state untouched, so every miss would otherwise be reported as done.
 */
function editNode(
  input: Record<string, unknown>,
  build: (node: SceneNode, documentId: string) => Command<SceneState> | null,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  const named = textOf(input, 'nodeId') ?? ''
  const node = nodeAimed(open.state, named)
  // 🛑 Told apart: a node that is not there and an edit with nothing to do read the same as
  // `badInput`, and a client re-sent a `node.remove` whose node it had just removed — 33 refusals
  // on the bench pass of 2026-08-26, none of them saying the object was already gone.
  if (!node) return refused('notFound', noSuchNode(named, open.state.nodes))

  const command = build(node, open.documentId)
  if (!command) return refused('badInput', `"${node.name}" has nothing to change here`)

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** The nodes a `nodeIds` list names, by id or by name — what the two folding handlers aim at. */
function aimedNodes(state: SceneState, input: Record<string, unknown>): SceneNode[] {
  return textsOf(input, 'nodeIds')
    .map(id => nodeAimed(state, id))
    .filter(node => node !== undefined)
}

/** A vector read three axes at a time, each one falling back to where the node already is. */
function vectorOf(
  input: Record<string, unknown>,
  of: string,
  current: Vector3,
  relative = false,
): Vector3 {
  const axis = (name: 'x' | 'y' | 'z'): number =>
    composedNumber(
      current[name],
      numberOf(input, `${of}${name.toUpperCase()}`),
      relative,
      of === 'scale' ? 'multiply' : 'add',
    )

  return { x: axis('x'), y: axis('y'), z: axis('z') }
}

/** The specs of one shape, read by name — the tables are keyed by kind and typed per kind. */
type Specs = { readonly [name: string]: PropertySpec | undefined }

/** Everything a call names apart from the node itself: what the descriptor must answer for. */
function namedFields(input: Record<string, unknown>): string[] {
  return Object.keys(input).filter(key => key !== 'nodeId' && key !== 'relative')
}

/**
 * Whether a number sits inside what the field's own control enforces — a slider clamps its travel
 * just as the number field clamps its bounds, so both are limits and neither is a suggestion.
 */
function withinSpec(spec: PropertySpec | undefined, value: number): boolean {
  const bounds = numericBoundsOf(spec)
  return bounds === null || withinBounds(value, bounds)
}

/**
 * The numbers a call writes onto one descriptor, or a refusal. The registry can only publish the
 * UNION over kinds — a torus takes one radial segment where a capsule takes three — so this is
 * where the kind in hand narrows it.
 */
function numbersFor(
  input: Record<string, unknown>,
  descriptor: object,
  specs: Specs,
): Record<string, number> | null {
  const written: Record<string, number> = {}

  for (const name of namedFields(input)) {
    const value = numberOf(input, name)
    if (value === null || !(name in descriptor) || !withinSpec(specs[name], value)) return null
    written[name] = value
  }

  return written
}

/** The axes of a light's target, which travel as three numbers and land as one field. */
const TARGET_AXES: readonly string[] = ['targetX', 'targetY', 'targetZ']

/** The three of a rail's point, read the same way. */
const POINT_AXES: readonly string[] = ['pointX', 'pointY', 'pointZ']

/** The mirror of what `setShadowOn` SKIPS — and a skipped node leaves a command that reads as done. */
function canShadow(
  node: SceneNode,
  changes: { castShadow?: boolean; receiveShadow?: boolean },
): boolean {
  if (changes.castShadow !== undefined && !canCastShadow(node)) return false
  return changes.receiveShadow === undefined || canReceiveShadow(node)
}

/** A picture named by id, or none — an empty id is the map taken off. */
function assetRef(input: Record<string, unknown>, key: string): { assetId: string } | null {
  const assetId = textOf(input, key)
  return assetId === null ? null : { assetId }
}

/** The typeface a call names, either half of it, over the one the node already wears. */
function fontFrom(input: Record<string, unknown>, current: FontRef): FontRef | null {
  const family = textOf(input, 'fontFamily')
  const source = oneOf(input, 'fontSource', FONT_SOURCES)
  if (family === null && source === null) return null

  return { family: family ?? current.family, source: source ?? current.source }
}

/** The map slots a call names, as a material stores them — `null` and absent being two answers. */
function texturesFrom(
  input: Record<string, unknown>,
): Partial<Record<TextureSlot, { assetId: string } | null>> | null {
  if (input.textures === undefined) return {}

  const asked = recordOf(input, 'textures')
  if (!asked) return null

  const slots: Record<string, { assetId: string } | null> = {}
  for (const [slot, value] of Object.entries(asked)) {
    if (typeof value !== 'string') return null
    slots[slot] = value.trim() === '' ? null : { assetId: value }
  }

  return slots
}

/**
 * The nodes worth answering FIRST — what is chosen, then what an author put there, then the rest.
 *
 * 🛑 `resultLine` gives an over-long list what room is left and drops the tail, so the order here
 * decides what a model gets to see. Left in the document's own order, a scene answered its
 * template's ambient light and nothing else: « place la sphère deux mètres à droite du cube »
 * re-read the same state five times over, measured 2026-09-01.
 */
function mostWanted(nodes: readonly SceneNode[], selectedIds: readonly string[]): SceneNode[] {
  const rank = (node: SceneNode): number => {
    if (selectedIds.includes(node.id)) return 0
    return node.type === 'light' || node.type === 'camera' ? 2 : 1
  }

  // `sort` is stable, so equal ranks keep the document's own order — no tie-breaker needed.
  return [...nodes].sort((one, other) => rank(one) - rank(other))
}

/**
 * What a record holds APART from what a fresh one holds — absent reads as the default.
 *
 * 🛑 The one rule of this answer, and it is measured: `resultLine` cuts by whole members and
 * `nodes` is the only one carrying an id, so every character spent saying « unchanged » is one
 * taken from the objects. A world of 355, a material of 145 of `null`, a sphere of 53 saying it
 * has the segments a sphere always has — a five-object scene answered ONE of them on 2026-09-01.
 */
function apartFrom<T extends object>(held: T, standing: T): Partial<T> {
  const apart: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(held)) {
    if (JSON.stringify(value) !== JSON.stringify(standing[key as keyof T])) apart[key] = value
  }
  return apart as Partial<T>
}

/**
 * How finely a shape is divided, which changes nothing a request can name.
 *
 * 🛑 The MEASUREMENTS stay, whatever they are: a default sphere's radius of 0.5 is what « fais-le
 * un mètre de large » is computed from, and unlike a colour it cannot be guessed back — a default
 * is per primitive. Only the segment counts go.
 */
const SEGMENT_FIELDS: readonly string[] = [
  'widthSegments',
  'heightSegments',
  'depthSegments',
  'radialSegments',
  'capSegments',
  'tubularSegments',
  'segments',
  'curveSegments',
]

/** A geometry with the segment counts its own primitive is born with left out. */
function shapeApart(geometry: GeometryDescriptor): Partial<GeometryDescriptor> {
  const born = primitiveByKind(geometry.kind)?.create()
  if (!born) return geometry

  const kept: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(geometry)) {
    const standing = born[key as keyof GeometryDescriptor]
    if (!SEGMENT_FIELDS.includes(key) || value !== standing) kept[key] = value
  }
  return kept as Partial<GeometryDescriptor>
}

/** A record left out entirely when nothing in it differs — `material: {}` says only what absence says. */
const unlessBare = (key: string, held: object): Record<string, object> =>
  Object.keys(held).length === 0 ? {} : { [key]: held }

/** A list left out entirely when it holds nothing — `shots: []` says only what absence says. */
const someOrNone = <T>(key: string, items: readonly T[]): Record<string, readonly T[]> =>
  items.length === 0 ? {} : { [key]: items }

/** The cued rows that hold something — four empty lists cost 62 characters saying nothing. */
function cuesLaid(animation: SceneAnimation): Record<string, unknown> {
  const cues = {
    ...someOrNone('events', animation.events ?? []),
    ...someOrNone('audio', animation.audio ?? []),
    ...someOrNone('video', animation.video ?? []),
    ...someOrNone('transitions', animation.transitions ?? []),
  }
  return Object.keys(cues).length === 0 ? {} : { cues }
}

/**
 * The refusal for a node nobody holds, naming the ones the scene DOES — bounded, so a busy scene
 * does not spend a turn on a list.
 *
 * 🛑 Told only that its word matched nothing, a model invented another: « château », « chevalier »
 * and « caméra » were each aimed at twice over on the pass of 2026-09-01, on a scene holding
 * « Cube Test ». What it needs to correct itself is the names, and it has them in one line.
 */
export function noSuchNode(named: string, nodes: readonly SceneNode[]): string {
  const held = nodes
    .slice(0, NAMES_IN_A_REFUSAL)
    .map(one => `"${one.name}"`)
    .join(', ')
  const rest = nodes.length - Math.min(nodes.length, NAMES_IN_A_REFUSAL)

  return nodes.length === 0
    ? `no node "${named}": the scene in front holds none`
    : `no node "${named}" in the scene in front, by id or name — it holds ${held}${rest > 0 ? `, and ${rest} more` : ''}`
}

/** How many names a refusal spells. Past this a busy scene spends the turn on a list. */
const NAMES_IN_A_REFUSAL = 8

/** A node's `transform`, or nothing at all when it has not left where a fresh one stands. */
function moved(transform: Transform): { transform: Partial<Transform> } | null {
  const parts = movedParts(transform)
  return Object.keys(parts).length === 0 ? null : { transform: parts }
}

function readState(): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  return {
    ok: true,
    data: {
      /**
       * 🛑 The ID-BEARING members first, and `tracks` ahead of `nodes`: a list that holds nothing
       * is left out entirely, so a scene with no animation gives `nodes` the whole budget, while
       * an animated one spends it on the bands — where `target.nodeId` names the object anyway.
       * Raising the ceiling instead moved the bench score by nothing at all, twice — the figures
       * are in `conversation.ts`. What made a scene readable was making the ANSWER smaller.
       */
      documentId: open.documentId,
      selectedIds: open.state.selectedIds,
      // The band's own half. `channel.remove` and `key.move` name a channel by the id only this
      // hands over, and `animation.settings` writes the two numbers beside it.
      fps: open.state.animation.fps,
      duration: open.state.animation.duration,
      // What drives the cameras: without them a client can open a shot and never edit one, since
      // `camera.rail` and `camera.target` name it by the id only this list hands over.
      ...someOrNone('shots', open.state.animation.shots),
      /**
       * 🛑 The four cued lists, by the same rule as `shots`: `timeline.removeSceneCue` names a row
       * by the id ONLY this hands over, so a client could lay a cue and never take one back —
       * « retire le fondu que tu viens de poser » had nothing to read, measured 2026-08-31.
       */
      ...cuesLaid(open.state.animation),
      // The whole world and not its environment alone: the fog, the backdrop, the ground and the
      // grading are document values, and a client that can write them has to be able to read them.
      ...someOrNone(
        'tracks',
        open.state.animation.tracks.map(track => ({
          id: track.id,
          name: track.name,
          index: track.index,
          // At their default, left out like everything else here: a band is heard, alone with the
          // others, and unlocked. Three of them cost 47 characters a track, and a two-track scene
          // answered ONE — « supprime uniquement l'animation de rotation » never saw the other.
          ...(track.muted ? { muted: true } : {}),
          ...(track.solo ? { solo: true } : {}),
          ...(track.locked ? { locked: true } : {}),
          target: track.target,
          keys: track.keys.map(key => key.time),
        })),
      ),
      nodes: mostWanted(open.state.nodes, open.state.selectedIds).map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        ...(node.parentId === null ? {} : { parentId: node.parentId }),
        ...(node.visible ? {} : { visible: false }),
        // By PARTS: a node merely moved carried its unturned rotation and its unscaled scale for
        // 78 characters, in the one member the answer could not afford to lose.
        ...(moved(node.transform) ?? {}),
        ...(node.type === 'mesh'
          ? {
              geometry: shapeApart(node.geometry),
              ...unlessBare('material', apartFrom(node.material, DEFAULT_MATERIAL)),
            }
          : {}),
        ...(node.type === 'light' ? { light: node.light } : {}),
        ...(node.type === 'model' ? { model: node.model } : {}),
        ...(node.type === 'camera' ? { camera: node.camera } : {}),
        // The points of a rail, so binding one is not done blind — `camera.rail` takes the id
        // from here, and what the rail looks like decides which one a client wants.
        ...(node.type === 'path' ? { path: node.path } : {}),
        // The recipe and the material: without them a solid reads as a bare `type` and a client
        // cannot tell a pierced wall from a welded one, nor know there is anything to separate.
        ...(node.type === 'carved'
          ? {
              carved: node.carved,
              ...unlessBare('material', apartFrom(node.material, DEFAULT_MATERIAL)),
            }
          : {}),
      })),
      world: apartFrom(open.state.world, DEFAULT_WORLD),
      // The INSTANTS of the keys, never their values: what a key holds is a delta nothing here
      // writes, and a ten-second take at every frame is a megabyte of it across the boundary.
      /**
       * The flat list the state itself holds — the tree is derived from `parentId`, and handing
       * one over would be a second shape of the same thing for a client to walk.
       *
       * 🛑 A value AT ITS DEFAULT is left out, and absent reads as that default: no parent, drawn,
       * standing at the origin unturned and unscaled. `resultLine` cuts by whole members and this
       * is the last one, so a scene of three objects came back `(cut short: nodes)` — the model
       * could not name ONE object of the scene it was editing, measured 2026-09-01. An identity
       * transform alone cost 118 characters a node.
       */
    },
  }
}

/**
 * The rail one call reshapes, written whole. A change that hands the SAME points back is a
 * refusal: that is how every helper of `cameraPath` declines, and a no-op banked in the history
 * would give ⌘Z a state nobody left.
 */
function editPath(
  input: Record<string, unknown>,
  change: (path: PathDescriptor) => PathDescriptor,
): ActionOutcome {
  return editNode(input, node => {
    if (node.type !== 'path') return null

    const next = change(node.path)
    return next === node.path ? null : setPath(node.id, next)
  })
}

/**
 * The same as `editNode`, for one named SHOT. A client works on shots by id because that is what
 * `scene.state` hands it — an instant would leave two shots of one camera to choose between.
 */
function editShot(
  input: Record<string, unknown>,
  build: (shot: CameraShot, state: SceneState) => Command<SceneState> | null,
  /** What a caller does when the shot IS there and the build still declines. */
  nothing: string,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  const shotId = textOf(input, 'shotId') ?? ''
  const shot = open.state.animation.shots.find(held => held.id === shotId)
  if (!shot)
    return refused(
      'badInput',
      `no camera shot "${shotId}" on this scene's band — scene.state answers "shots" with their ids, and camera.addShot opens one`,
    )

  const command = build(shot, open.state)
  if (!command) return refused('badInput', nothing)

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** A shot opened for a camera, answering the id it was born with — a client edits it by that. */
function openShot(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  const nodeId = textOf(input, 'nodeId') ?? ''
  if (nodeAimed(open.state, nodeId)?.type !== 'camera') {
    return refused(
      'badInput',
      `"nodeId" reads "${nodeId}", which is no camera of this scene — scene.state answers "nodes", and a shot needs one of type "camera"`,
    )
  }

  const seconds = numberOf(input, 'durationSeconds')
  const opened = newShotAt(
    open.state.animation,
    nodeId,
    newId(),
    (numberOf(input, 'startSeconds') ?? 0) * SECOND,
  )
  // The floor `newShotAt` holds is a frame, and a duration below it would be a bar nothing can
  // grab back.
  const shot =
    seconds === null ? opened : { ...opened, duration: Math.max(opened.duration, seconds * SECOND) }

  useScenes.getState().runCommand(open.documentId, addCameraShot(shot))
  return { ok: true, data: { shotId: shot.id } }
}

/** Adds a node the caller built, answering the id it was born with. */
function place(node: SceneNode | null): ActionOutcome {
  if (!node) return refused('badInput', 'nothing to place — no node could be built from this call')

  const outcome = edit(() => addNode(node))
  return outcome.ok ? { ok: true, data: { nodeId: node.id } } : outcome
}

function add(input: Record<string, unknown>): ActionOutcome {
  // The factory answers `null` for a kind no registry declares, which is where it becomes a
  // refusal rather than a node that never arrived.
  const node = createNodeOf(textOf(input, 'kind') ?? '')
  if (!node)
    return refused(
      'badInput',
      `no node kind "${textOf(input, 'kind') ?? ''}" can be built — the "kind" field of this action lists the ones that can`,
    )

  return place({
    ...node,
    name: textOf(input, 'name') ?? node.name,
    transform: {
      ...node.transform,
      position: vectorOf(input, 'position', node.transform.position),
    },
  })
}

function select(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  const known = new Set(open.state.nodes.map(node => node.id))
  const nodeIds = textsOf(input, 'nodeIds')
  const missing = nodeIds.filter(id => !known.has(id))
  if (missing.length > 0)
    return refused(
      'notFound',
      `the scene in front holds no node ${missing.join(', ')} — scene.state answers "nodes" with the ids it does hold`,
    )

  // Selection is not a command: it stays out of the history, so `replace` writes the state.
  useScenes.getState().replace(open.documentId, setSelection(open.state, nodeIds))
  return { ok: true }
}

/**
 * What a sentence may aim at inside a scene, as the outliner names them.
 *
 * 🛑 Published for the same reason the layer stack is: without it the briefing named no node at
 * all, and a model asked to move « le cube » spelled an id it had invented — `<nodeId>`, the
 * name in the id's place, `node-1`. The tree is FLATTENED here: `narrowTargets` ranks and cuts,
 * and depth is not what a spoken request picks by.
 */
export function nodeTargets(): readonly Target[] {
  const open = mounted()
  if (!open) return []

  return open.state.nodes.map(node => ({
    id: node.id,
    kind: 'node',
    name: node.name,
    selected: open.state.selectedIds.includes(node.id),
  }))
}

/** Aiming at one of them, through the same door `node.select` uses — never a second path. */
export function selectNode(id: string): ActionOutcome {
  return select({ nodeIds: [id] })
}

function reparent(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  const parentId = textOf(input, 'parentId')
  if (parentId !== null && !nodeAimed(open.state, parentId)) {
    return refused(
      'notFound',
      `no node "${parentId}" in the scene in front, by id or name — scene.state answers "nodes"; send "" to hang this one at the root`,
    )
  }

  // A place among the new siblings, or none: hanging a node somewhere leaves it where it already
  // sits, which is what dropping a row ONTO another does on screen.
  const index = numberOf(input, 'index')

  // A move that would close the tree on itself is refused by handing the state back untouched,
  // which without this reads as done.
  return editNode(input, node =>
    !canReparent(open.state.nodes, node.id, parentId)
      ? null
      : index === null
        ? reparentNode(node.id, parentId)
        : reorderNodes([node.id], parentId, index),
  )
}

// `editNode`'s twin for the half of the document that belongs to no node. An empty patch is a
// refusal rather than a no-op: a client that named nothing meant something.
function editWorld(
  build: (world: SceneWorld) => Partial<SceneWorld>,
  /** What a caller does when the patch comes back empty — the fields differ from action to action. */
  nothing: string,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_SCENE)

  const patch = build(open.state.world)
  if (Object.keys(patch).length === 0) return refused('badInput', nothing)

  useScenes.getState().runCommand(open.documentId, setWorld(patch))
  return { ok: true }
}

/** A scene takes intensity and rotation on their own, so no source named is not a refusal. */
function worldEnvironment(input: Record<string, unknown>): ActionOutcome | Promise<ActionOutcome> {
  const intensity = numberOf(input, 'intensity')
  const rotation = numberOf(input, 'rotation')

  return environmentFromInput(input, environment =>
    editWorld(
      () => ({
        ...(environment === null ? {} : { environment }),
        ...(intensity === null ? {} : { envIntensity: intensity }),
        // Radians, as every other angle a document stores — the panel is what shows degrees.
        ...(rotation === null ? {} : { envRotation: rotation }),
      }),
      'this call named no light: give assetId, sky or kind for the source, intensity or rotation for the dials',
    ),
  )
}

function worldBackground(input: Record<string, unknown>): ActionOutcome {
  const kind = oneOf(input, 'kind', BACKGROUND_KINDS)
  if (!kind) return refused('badInput', `"kind" wants one of: ${BACKGROUND_KINDS.join(', ')}`)
  // `blur` belongs to one shape only, and a key a client believes took must never get a silent
  // yes — the very rule `validatesInput` is written for, one level down.
  if (kind !== 'environment' && input.blur !== undefined)
    return refused(
      'badInput',
      `"blur" belongs to the "environment" background alone, and this call says kind "${kind}"`,
    )
  if (kind !== 'color' && input.color !== undefined)
    return refused(
      'badInput',
      `"color" belongs to the "color" background alone, and this call says kind "${kind}"`,
    )

  return editWorld(world => {
    // The switch the panel uses, and ONLY when the shape changes: it answers with the defaults of
    // the shape it opens, so re-asserting the shape in hand would take the blur back to zero.
    const background =
      world.background.kind === kind ? world.background : backgroundOfKind(kind, world.background)

    if (background.kind === 'color') {
      return { background: { ...background, color: readColor(input, 'color', background.color) } }
    }

    return background.kind === 'environment'
      ? { background: { ...background, blur: numberOf(input, 'blur') ?? background.blur } }
      : { background }
  }, `a "${kind}" background writes nothing from this call`)
}

function worldFog(input: Record<string, unknown>): ActionOutcome {
  const kind = oneOf(input, 'kind', FOG_KINDS)
  if (!kind) return refused('badInput', `"kind" wants one of: ${FOG_KINDS.join(', ')}`)
  const named = ['color', 'near', 'far', 'density'].filter(key => input[key] !== undefined)
  const belongs =
    kind === 'linear' ? ['color', 'near', 'far'] : kind === 'exp2' ? ['color', 'density'] : []
  const stray = named.filter(key => !belongs.includes(key))
  if (stray.length > 0)
    return refused(
      'badInput',
      `a "${kind}" fog takes ${belongs.length === 0 ? 'no field but kind' : belongs.join(', ')}, and this call names ${stray.join(', ')}`,
    )

  return editWorld(world => {
    // Switched only when the shape changes, for the reason `worldBackground` gives: `fogOfKind`
    // answers with the defaults of the shape it opens, distances included.
    const fog = world.fog.kind === kind ? world.fog : fogOfKind(kind, world.fog)
    if (fog.kind === 'none') return { fog }

    const painted = { ...fog, color: readColor(input, 'color', fog.color) }

    return {
      fog:
        painted.kind === 'linear'
          ? {
              ...painted,
              near: numberOf(input, 'near') ?? painted.near,
              far: numberOf(input, 'far') ?? painted.far,
            }
          : { ...painted, density: numberOf(input, 'density') ?? painted.density },
    }
  }, `a "${kind}" fog writes nothing from this call`)
}

function worldGround(input: Record<string, unknown>): ActionOutcome {
  const size = numberOf(input, 'size')
  const opacity = numberOf(input, 'opacity')

  return editWorld(world => {
    // `undefined` and not `false`: a call naming the size alone must not put the ground out.
    const written = {
      ...(input.visible === undefined ? {} : { visible: boolOf(input, 'visible') }),
      ...(input.color === undefined
        ? {}
        : { color: readColor(input, 'color', world.ground.color ?? '') }),
      ...(size === null ? {} : { size }),
      ...(opacity === null ? {} : { opacity }),
      ...(input.receiveShadow === undefined
        ? {}
        : { receiveShadow: boolOf(input, 'receiveShadow') }),
    }

    return Object.keys(written).length === 0 ? {} : { ground: { ...world.ground, ...written } }
  }, 'this call named nothing to write on the ground: visible, color, size, opacity or receiveShadow')
}

export const SCENE_HANDLERS: ActionHandlers = {
  'scene.state': readState,

  'world.setSceneLighting': worldEnvironment,
  'world.setBackground': worldBackground,
  'world.setFog': worldFog,
  'world.setGroundPlane': worldGround,

  'world.setToneMapping': input => {
    const toneMapping = oneOf(input, 'toneMapping', TONE_MAPPINGS)
    const exposure = numberOf(input, 'exposure')

    return editWorld(
      () => ({
        ...(toneMapping === null ? {} : { toneMapping }),
        ...(exposure === null ? {} : { exposure }),
      }),
      'this call named neither toneMapping nor exposure, and one of the two is what it writes',
    )
  },
  'node.add': add,
  'node.select': select,
  'node.reparent': reparent,

  /**
   * 🛑 Through `withAsset`: an id nothing holds used to make a node all the same, and the caller
   * was answered `ok` with the id of a model that shows nothing. Measured on the bench pass of
   * 2026-08-25, where `assetId: "<meshId>"` — the placeholder, spelt out — was accepted.
   */
  'node.addModel': input => {
    const assetId = textOf(input, 'assetId') ?? ''
    return withAsset(assetId, () => place(modelNode(assetId, textOf(input, 'name') ?? assetId)))
  },

  'node.remove': input => editNode(input, node => removeNode(node.id)),

  /**
   * Marks shapes as tools for the next fold, or takes the mark off. The same command the toolbar
   * runs, so both doors read one rule — `carvePlan` says what a mark means.
   */
  'node.markAsCuttingTool': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface', NO_SCENE)

    const named = textsOf(input, 'nodeIds')
    const picked = aimedNodes(open.state, input)
    // Every id, not merely the ones that resolved: a misspelt name would otherwise mark half the
    // selection and answer `ok`, and the next fold would run the wrong way with nothing said.
    if (picked.length !== named.length)
      return refused('notFound', `no node "${named}" in the scene in front`)
    if (!canNegate(picked)) return refused('badInput', 'none of those nodes carries a shape')

    // Absent means "mark them", the gesture a client asks for nine times out of ten; the toolbar
    // toggles instead, since a button has no room to say which of the two it means.
    const negative = maybeBoolOf(input, 'negative') ?? true
    useScenes.getState().runCommand(open.documentId, setNodesNegative(picked, negative))
    return { ok: true }
  },

  /**
   * The ORDER OF THE IDS says nothing: a marked shape is a tool, and what is left is elected by
   * volume — `carvePlan` is where both rules live, and the toolbar reads the same one. `matterId`
   * names the matter outright, for the rare cut that runs the other way.
   */
  'node.combineIntoSolid': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface', NO_SCENE)

    const operation = oneOf(input, 'operation', CSG_OPERATIONS)
    const command =
      operation &&
      carveNodes(
        aimedNodes(open.state, input),
        operation,
        open.state.nodes,
        textOf(input, 'matterId') ?? undefined,
      )
    // Two ways in: a selection where something carries no shape, or a `matterId` naming nothing
    // that could BE the matter — see `carvePlan`, which refuses rather than electing otherwise.
    if (!command) return refused('badInput', 'every id must carry a shape, and matterId be one')

    useScenes.getState().runCommand(open.documentId, command)
    // The id the description promises: a client cannot address the solid otherwise, short of
    // re-reading the whole scene. Read off the state after, since the command mints it.
    const solid = sceneOf(useScenes.getState(), open.documentId).nodes.find(
      node => node.type === 'carved' && !open.state.nodes.includes(node),
    )
    return { ok: true, data: { nodeId: solid?.id ?? '' } }
  },

  'node.swapSolidMatterAndTool': input =>
    editNode(input, (node, documentId) =>
      node.type === 'carved'
        ? invertCarve(node, sceneOf(useScenes.getState(), documentId).nodes)
        : null,
    ),

  'node.separate': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface', NO_SCENE)

    const node = nodeAimed(open.state, textOf(input, 'nodeId') ?? '')
    if (node?.type !== 'carved')
      return refused(
        'badInput',
        `"nodeId" must name a carved solid, which node.combineIntoSolid makes — scene.state answers "nodes", the ones with type "carved"`,
      )

    useScenes.getState().runCommand(open.documentId, separateNode(node))
    // The shapes handed back, as the description promises — their ids are what a client aims at
    // next, and nothing else names them.
    const after = sceneOf(useScenes.getState(), open.documentId)
    const given = after.nodes.filter(one => !open.state.nodes.includes(one)).map(one => one.id)
    return { ok: true, data: { nodeIds: given } }
  },

  'node.rename': input =>
    editNode(input, node => renameNode(node.id, textOf(input, 'name') ?? node.name)),

  'node.setVisible': input =>
    editNode(input, node => setNodeVisible(node.id, boolOf(input, 'visible'))),

  /**
   * The gizmo's own translation, and what an unnamed axis falls back to is the whole point: the
   * POSE PLAYED, never the rest. `recordMove` keys every channel from that fallback, so resting
   * values would write a neutral rotation over the key standing there. Radians, as the state.
   */
  'node.transform': input =>
    editNode(input, (node, documentId) => {
      const keying = sceneKeyingAt(documentId)
      const played = poseAt(node.transform, keying.state.animation, node.id, keying.at)
      const by = boolOf(input, 'relative')

      return movesToCommand(
        keying.state,
        [
          {
            id: node.id,
            transform: {
              position: vectorOf(input, 'position', played.position, by),
              rotation: vectorOf(input, 'rotation', played.rotation, by),
              scale: vectorOf(input, 'scale', played.scale, by),
            },
          },
        ],
        keying.at,
        keying.recording,
      )
    }),

  'node.setMeshMaterial': input =>
    editNode(input, node => {
      if (!carriesMaterial(node)) return null
      // Neither a text's outline nor a cut result is a primitive, so their UVs never go through
      // the tiling — the field the inspector drops for both is refused here rather than filed
      // and ignored.
      if (node.type !== 'mesh' && input.tilesPerMetre !== undefined) return null

      const textures = texturesFrom(input)
      if (!textures) return null

      const roughness = numberOf(input, 'roughness')
      const metalness = numberOf(input, 'metalness')
      const tilesPerMetre = numberOf(input, 'tilesPerMetre')
      const changes: Partial<MaterialDescriptor> = {
        ...(input.color === undefined
          ? {}
          : { color: readColor(input, 'color', node.material.color ?? '') }),
        ...(roughness === null ? {} : { roughness }),
        ...(metalness === null ? {} : { metalness }),
        ...(tilesPerMetre === null ? {} : { tilesPerMetre }),
        ...textures,
      }

      return Object.keys(changes).length === 0 ? null : setMaterialOn([node], changes)
    }),

  'node.setPrimitiveParameters': input =>
    editNode(input, node => {
      if (node.type !== 'mesh') return null

      const written = numbersFor(input, node.geometry, GEOMETRY_SPECS[node.geometry.kind])
      if (!written || Object.keys(written).length === 0) return null

      // The whole descriptor at once rather than one field per command: `setGeometryOn` is built
      // from the geometry as it stands when the command is MADE, so chaining three would keep
      // only the last. `withField` is what the inspector folds a field in with.
      return setGeometry(
        node.id,
        Object.entries(written).reduce(
          (geometry, [name, value]) => withField(geometry, name, value),
          node.geometry,
        ),
      )
    }),

  'node.setShadowCastAndReceive': input =>
    editNode(input, node => {
      const changes = {
        ...(input.castShadow === undefined ? {} : { castShadow: boolOf(input, 'castShadow') }),
        ...(input.receiveShadow === undefined
          ? {}
          : { receiveShadow: boolOf(input, 'receiveShadow') }),
      }
      if (Object.keys(changes).length === 0) return null

      // `setShadowOn` skips a node that cannot hold what it was given — a light catches nothing —
      // and a skipped node leaves an empty command, which reads as done. Refused instead.
      return canShadow(node, changes) ? setShadowOn([node], changes) : null
    }),

  'node.setSpriteSettings': input =>
    editNode(input, node => {
      if (node.type !== 'sprite') return null

      const opacity = numberOf(input, 'opacity')
      const changes: Partial<SpriteDescriptor> = {
        ...(input.color === undefined
          ? {}
          : { color: readColor(input, 'color', node.sprite.color ?? '') }),
        ...(opacity === null ? {} : { opacity }),
        ...(input.map === undefined ? {} : { map: assetRef(input, 'map') }),
      }

      return Object.keys(changes).length === 0 ? null : setSpriteOn([node], changes)
    }),

  'node.setTextSettings': input =>
    editNode(input, node => {
      if (node.type !== 'text') return null

      const font = fontFrom(input, node.text.font)
      const value = textOf(input, 'value')
      const curveSegments = numberOf(input, 'curveSegments')
      // Their own keys because a geometry already holds both: a box has a depth in scene units
      // and a letter has one out of its own plane, and one word for the two said neither.
      const size = numberOf(input, 'textSize')
      const depth = numberOf(input, 'textDepth')

      const changes: Partial<TextDescriptor> = {
        ...(value === null ? {} : { value }),
        ...(font === null ? {} : { font }),
        ...(curveSegments === null ? {} : { curveSegments }),
        ...(size === null ? {} : { size }),
        ...(depth === null ? {} : { depth }),
      }

      return Object.keys(changes).length === 0 ? null : setTextOn([node], changes)
    }),

  'node.setPathShape': input =>
    editPath(input, path => {
      const tension = numberOf(input, 'tension')
      // The same rail back is what `editPath` reads as a refusal: a call that named nothing meant
      // something, and a spread would otherwise hand back a fresh object that changed nothing.
      if (tension === null && input.closed === undefined) return path

      return {
        ...path,
        ...(tension === null ? {} : { tension }),
        ...(input.closed === undefined ? {} : { closed: boolOf(input, 'closed') }),
      }
    }),

  'path.addPoint': input => {
    const index = numberOf(input, 'index')
    const aimed = POINT_AXES.filter(axis => input[axis] !== undefined)
    // A point AIMED at is laid past the last one, as a click in the viewport lays it; an index
    // says "halfway after this one" instead. Naming both would be naming two places at once.
    if (aimed.length > 0 && index !== null)
      return refused(
        'badInput',
        'name a point with pointX, pointY and pointZ, or an "index" to lay one after — not both',
      )
    if (aimed.length > 0 && aimed.length < POINT_AXES.length)
      return refused('badInput', 'a point wants all three of pointX, pointY, pointZ')

    return editPath(input, path => {
      if (aimed.length === 0)
        return index === null ? withPointAtEnd(path) : withPointAfter(path, index)

      // Every axis is named, so nothing of the fallback is read.
      return withPointAppended(path, vectorOf(input, 'point', { x: 0, y: 0, z: 0 }))
    })
  },

  'path.movePoint': input =>
    editPath(input, path => {
      const index = numberOf(input, 'index') ?? -1
      const held = path.points[index]
      return held ? withMovedPoint(path, index, vectorOf(input, 'point', held)) : path
    }),

  'path.removePoint': input =>
    editPath(input, path => withoutPoint(path, numberOf(input, 'index') ?? -1)),

  'model.wearMaterial': input =>
    editNode(input, node => {
      if (node.type !== 'model') return null

      // The TITLE, because a document id is not something anyone types. An empty one takes the
      // whole dress off, and the model goes back to what its own file carries.
      const title = textOf(input, 'material')
      if (!title) return dressModel(node.id, null)

      // Zero unless one is named: a model with one material is the ordinary case, and a caller
      // that says nothing about slots means the first. Refused rather than swallowed out of range
      // — `withMaterialAt` is a pure function and can only answer the list unchanged.
      const slot = numberOf(input, 'slot') ?? 0
      if (!Number.isInteger(slot) || slot < 0 || slot >= MATERIAL_SLOTS) return null

      const wanted = documentNamedOfKind(useDocuments.getState(), 'material', title)
      return wanted ? wearMaterialAt(node.id, slot, wanted) : null
    }),

  /** The picture must EXIST, or the model holds a reference nothing resolves — see `world.environment`. */
  'model.wearImage': input => {
    const assetId = textOf(input, 'assetId')
    const write = (): ActionOutcome =>
      editNode(input, node =>
        node.type === 'model'
          ? dressModel(node.id, assetId ? { kind: 'image', assetId } : null)
          : null,
      )

    return assetId === null ? write() : withAsset(assetId, write)
  },

  /**
   * The lens, through the inspector's own translation — `fov` may be keyed, the two distances
   * never are. The lens handed over keeps the fov it ALREADY holds: that value is what its key is
   * measured against, and a new one there moves the rest pose under every other key.
   */
  'node.setCameraLens': input =>
    editNode(input, (node, documentId) => {
      if (node.type !== 'camera') return null

      const written = numbersFor(input, node.camera, CAMERA_SPECS)
      if (!written || Object.keys(written).length === 0) return null

      // The two distances are never keyed, so they travel as a plain descriptor — and the lens
      // handed to `lensToCommand` keeps the fov it ALREADY holds: that value is what its key is
      // measured against, and a new one there would move the rest pose under every other key.
      const camera = { ...node.camera, ...written, fov: node.camera.fov }
      const fov = numberOf(input, 'fov')
      if (fov === null) return setCamera(node.id, camera)

      const keying = sceneKeyingAt(documentId)
      return multi(`camera:${node.id}`, [
        // Written first and then again by the lens where nothing records it: the keyed branch
        // writes no descriptor at all, and the two distances would be lost with it.
        setCamera(node.id, camera),
        lensToCommand(
          keying.state.animation,
          [{ ...node, camera }],
          'fov',
          fov,
          keying.at,
          keying.recording,
        ),
      ])
    }),

  // Seconds here, microseconds in the timeline: a client counting a shot in `Us` would be one
  // unit away from a film six orders of magnitude too long, with nothing on screen to say so.
  'camera.addShot': input => openShot(input),

  // Through the very command the inspector's own select goes through, so a rail bound from here
  // takes the whole of itself forwards exactly as one bound on screen does.
  'camera.bindPathToShot': input =>
    editShot(
      input,
      (shot, state) => {
        const pathId = textOf(input, 'pathId') ?? ''
        if (pathId === '') return bindRailToShot(shot, '')
        if (nodeById(state, pathId)?.type !== 'path') return null

        const from = numberOf(input, 'from')
        const to = numberOf(input, 'to')
        const easing = EASINGS.find(candidate => candidate === textOf(input, 'easing'))

        return bindRailToShot(shot, pathId, {
          ...(from === null ? {} : { from }),
          ...(to === null ? {} : { to }),
          ...(easing === undefined ? {} : { easing }),
        })
      },
      '"pathId" must name a rail of this scene — scene.state answers "nodes", and a rail is one of type "path"; send "" to unbind the one in place',
    ),

  // Through the panel's own command, which lays the rail AND binds it in one entry: a rail added
  // without its shot would be a line nothing runs on.
  'camera.createAndBindPath': input =>
    editShot(
      input,
      (shot, state) => {
        const camera = nodeById(state, shot.cameraId)
        return camera?.type === 'camera' ? railForShot(camera, shot) : null
      },
      'the camera this shot was opened for is gone from the scene — scene.state answers "nodes" and "shots"',
    ),

  'camera.reorder': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface', NO_SCENE)

    const nodeId = textOf(input, 'nodeId') ?? ''
    // `shotsWithCameraMoved` answers `null` for a camera with no line on the band, and reports
    // the steps it could actually take — a line already at the top moves by none.
    const moved = shotsWithCameraMoved(
      open.state.animation.shots,
      nodeId,
      numberOf(input, 'by') ?? 0,
    )
    if (!moved || moved.steps === 0)
      return refused(
        'badInput',
        `"${nodeId}" has no shot on the band, or "by" would move it past the end — scene.state answers "shots" and the camera each one holds`,
      )

    useScenes.getState().runCommand(open.documentId, reorderCameraShots(nodeId, moved.shots))
    return { ok: true, data: { steps: moved.steps } }
  },

  'camera.aimShotAt': input =>
    editShot(
      input,
      (shot, state) => {
        const targetId = textOf(input, 'targetId') ?? ''
        if (targetId !== '') {
          // A camera cannot watch itself: `aimCamera` drops that shot silently, and a refusal here
          // is what says so.
          if (targetId === shot.cameraId || !nodeById(state, targetId)) return null
          return editCameraShot(shot.id, { target: { kind: 'node', nodeId: targetId } })
        }

        // Naming no node and giving no point is FREE — the camera keeps its own rotation.
        const aimed =
          numberOf(input, 'atX') !== null ||
          numberOf(input, 'atY') !== null ||
          numberOf(input, 'atZ') !== null
        return editCameraShot(shot.id, {
          target: aimed
            ? { kind: POINT_TARGET.kind, at: vectorOf(input, 'at', POINT_TARGET.at) }
            : undefined,
        })
      },
      '"targetId" must name a node of this scene other than the shot\'s own camera — scene.state answers "nodes"; leave it out and give atX, atY, atZ to aim at a point instead',
    ),

  // A field the shape has no room for is refused rather than filed: `withField` writes by
  // computed key without checking, and a light given a `penumbra` it never had is a document
  // that no longer describes anything.
  'node.setLightSettings': input =>
    editNode(input, node => {
      if (node.type !== 'light') return null

      const specs: Specs = LIGHT_SPECS[node.light.kind]
      const by = boolOf(input, 'relative')
      let light = node.light

      for (const name of namedFields(input)) {
        if (TARGET_AXES.includes(name)) {
          if (!('target' in node.light)) return null
          continue
        }
        if (!(name in node.light)) return null

        const value = numberOf(input, name)
        if (value === null) {
          // A colour: the fallback is unreachable, `validatesInput` having agreed it is a hex.
          light = withField(light, name, readColor(input, name, ''))
          continue
        }

        const held = light[name as keyof typeof light]
        const wanted =
          typeof held === 'number' ? composedNumber(held, value, by, 'multiply') : value
        if (!withinSpec(specs[name], wanted)) return null
        light = withField(light, name, wanted)
      }

      if ('target' in node.light && TARGET_AXES.some(axis => input[axis] !== undefined)) {
        light = withField(light, 'target', vectorOf(input, 'target', node.light.target, by))
      }

      return light === node.light ? null : setLight(node.id, light)
    }),

  /**
   * The main pane, as the menu and the bar's own flyout both do: a quad layout gives each of its
   * four views one, and neither surface has four ways of saying it.
   */
  'view.direction': input => {
    const open = mounted()
    const direction = oneOf(input, 'direction', VIEW_DIRECTIONS)
    if (!open) return refused('wrongSurface', NO_SCENE)
    if (!direction)
      return refused('badInput', `"direction" wants one of: ${VIEW_DIRECTIONS.join(', ')}`)

    // A side to look from is a MOVE, not a state — see `PaneView` — so it goes to the engine.
    const engine = sceneEngineOf(open.documentId)
    if (!engine)
      return refused(
        'wrongSurface',
        'the scene in front has no viewport mounted to look through — panel.open the scene view, then send this again',
      )

    engine.viewFrom(direction)
    return { ok: true }
  },

  // The same function the menu row and the keyboard go through, which answers whether the still
  // landed: a viewport that is not mounted is a silence the row can live with and a client cannot.
  'scene.capture': async input => {
    const open = mounted()
    const quality = oneOf(input, 'quality', CAPTURE_QUALITIES) ?? DEFAULT_CAPTURE_QUALITY
    if (!open) return refused('wrongSurface', NO_SCENE)

    return (await captureSceneView(open.documentId, quality))
      ? { ok: true }
      : refused(
          'failed',
          'the scene viewport gave back no still — it is not mounted, or it rendered nothing',
        )
  },

  'world.applyPreset': input => {
    const preset = oneOf(input, 'preset', ENVIRONMENT_PRESETS)
    return preset === null
      ? refused('badInput', `"preset" wants one of: ${ENVIRONMENT_PRESETS.join(', ')}`)
      : editWorld(() => presetPatch(preset), `the preset "${preset}" writes nothing on this world`)
  },

  'view.display': input => {
    const open = mounted()
    const mode = oneOf(input, 'mode', DISPLAY_MODES)
    if (!open) return refused('wrongSurface', NO_SCENE)
    if (!mode) return refused('badInput', `"mode" wants one of: ${DISPLAY_MODES.join(', ')}`)

    useSceneViews.getState().setDisplay(open.documentId, MAIN_SCENE_PANE, mode)
    return { ok: true }
  },
}
