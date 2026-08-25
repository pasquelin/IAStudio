import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { Target } from '@shared/domain/target'
import { readColor } from '@shared/domain/color'
import { FONT_SOURCES, type FontRef } from '@shared/domain/font'
import {
  BACKGROUND_KINDS,
  DISPLAY_MODES,
  ENVIRONMENT_KINDS,
  FOG_KINDS,
  STUDIO_ENVIRONMENT,
  TEXTURE_SLOTS,
  TONE_MAPPINGS,
  VIEW_DIRECTIONS,
  type EnvironmentRef,
  type MaterialDescriptor,
  type ModelRef,
  type PathDescriptor,
  type SceneWorld,
  type SpriteDescriptor,
  type TextDescriptor,
  type TextureSlot,
  type Vector3,
} from '@shared/domain/scene'
import { CSG_OPERATIONS } from '@shared/domain/csg'
import { CAPTURE_QUALITIES, DEFAULT_CAPTURE_QUALITY } from '@shared/domain/sceneCapture'
import { SECOND } from '@shared/domain/time'
import { withinBounds } from '@shared/numeric'
import { captureSceneView } from '@/helpers/captureSceneView'
import { ENVIRONMENT_PRESETS, presetPatch } from '@/engines/scene/environmentPresets'
import {
  addNode,
  carveNodes,
  multi,
  removeNode,
  renameNode,
  reparentNode,
  setCamera,
  setGeometry,
  setLight,
  setMaterialOn,
  setModelMaterial,
  setModelTextures,
  setNodeVisible,
  setPath,
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
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { MAIN_SCENE_PANE, useSceneViews } from '@/stores/sceneViews'
import { sceneOf, useScenes } from '@/stores/scenes'
import { type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, recordOf, textOf, textsOf } from './actionInputs'

/**
 * The scene graph, driven by value.
 *
 * Every node enters through `createNodeOf`, the factory the Add menu and the native menu go
 * through — a second way of building a box is a second set of defaults to keep in step.
 */

/** The scene in front and its state, or nothing — which reads as `wrongSurface`. */
function mounted(): { documentId: string; state: SceneState } | null {
  const documentId = activeSceneId(useDocuments.getState())
  return documentId === null
    ? null
    : { documentId, state: sceneOf(useScenes.getState(), documentId) }
}

function edit(build: () => Command<SceneState>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

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
  if (!open) return refused('wrongSurface')

  const node = nodeById(open.state, textOf(input, 'nodeId') ?? '')
  const command = node && build(node, open.documentId)
  if (!command) return refused('badInput')

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** A vector read three axes at a time, each one falling back to where the node already is. */
function vectorOf(input: Record<string, unknown>, of: string, current: Vector3): Vector3 {
  return {
    x: numberOf(input, `${of}X`) ?? current.x,
    y: numberOf(input, `${of}Y`) ?? current.y,
    z: numberOf(input, `${of}Z`) ?? current.z,
  }
}

/** The specs of one shape, read by name — the tables are keyed by kind and typed per kind. */
type Specs = { readonly [name: string]: PropertySpec | undefined }

/** Everything a call names apart from the node itself: what the descriptor must answer for. */
function namedFields(input: Record<string, unknown>): string[] {
  return Object.keys(input).filter(key => key !== 'nodeId')
}

/**
 * Whether a number sits inside what the field's own control enforces — a slider clamps its travel
 * just as the number field clamps its bounds, so both are limits and neither is a suggestion.
 */
function withinSpec(spec: PropertySpec | undefined, value: number): boolean {
  if (spec === undefined || spec.control === 'color' || spec.control === 'vector3') return true
  return withinBounds(value, spec)
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

function readState(): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      documentId: open.documentId,
      selectedIds: open.state.selectedIds,
      // The whole world and not its environment alone: the fog, the backdrop, the ground and the
      // grading are document values, and a client that can write them has to be able to read them.
      world: open.state.world,
      // What drives the cameras: without them a client can open a shot and never edit one, since
      // `camera.rail` and `camera.target` name it by the id only this list hands over.
      shots: open.state.animation.shots,
      // The band's own half. `channel.remove` and `key.move` name a channel by the id only this
      // hands over, and `animation.settings` writes the two numbers beside it.
      fps: open.state.animation.fps,
      duration: open.state.animation.duration,
      // The INSTANTS of the keys, never their values: what a key holds is a delta nothing here
      // writes, and a ten-second take at every frame is a megabyte of it across the boundary.
      tracks: open.state.animation.tracks.map(track => ({
        id: track.id,
        name: track.name,
        index: track.index,
        muted: track.muted,
        solo: track.solo,
        locked: track.locked,
        target: track.target,
        keys: track.keys.map(key => key.time),
      })),
      // The flat list the state itself holds — the tree is derived from `parentId`, and handing
      // one over would be a second shape of the same thing for a client to walk.
      nodes: open.state.nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        visible: node.visible,
        transform: node.transform,
        ...(node.type === 'mesh' ? { geometry: node.geometry, material: node.material } : {}),
        ...(node.type === 'light' ? { light: node.light } : {}),
        ...(node.type === 'model' ? { model: node.model } : {}),
        ...(node.type === 'camera' ? { camera: node.camera } : {}),
        // The points of a rail, so binding one is not done blind — `camera.rail` takes the id
        // from here, and what the rail looks like decides which one a client wants.
        ...(node.type === 'path' ? { path: node.path } : {}),
        // The recipe and the material: without them a solid reads as a bare `type` and a client
        // cannot tell a pierced wall from a welded one, nor know there is anything to separate.
        ...(node.type === 'carved' ? { carved: node.carved, material: node.material } : {}),
      })),
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
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const shot = open.state.animation.shots.find(held => held.id === textOf(input, 'shotId'))
  const command = shot && build(shot, open.state)
  if (!command) return refused('badInput')

  useScenes.getState().runCommand(open.documentId, command)
  return { ok: true }
}

/** A shot opened for a camera, answering the id it was born with — a client edits it by that. */
function openShot(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const nodeId = textOf(input, 'nodeId') ?? ''
  if (nodeById(open.state, nodeId)?.type !== 'camera') return refused('badInput')

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
  if (!node) return refused('badInput')

  const outcome = edit(() => addNode(node))
  return outcome.ok ? { ok: true, data: { nodeId: node.id } } : outcome
}

function add(input: Record<string, unknown>): ActionOutcome {
  // The factory answers `null` for a kind no registry declares, which is where it becomes a
  // refusal rather than a node that never arrived.
  const node = createNodeOf(textOf(input, 'kind') ?? '')
  if (!node) return refused('badInput')

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
  if (!open) return refused('wrongSurface')

  const known = new Set(open.state.nodes.map(node => node.id))
  const nodeIds = textsOf(input, 'nodeIds')
  if (nodeIds.some(id => !known.has(id))) return refused('notFound')

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
  if (!open) return refused('wrongSurface')

  const parentId = textOf(input, 'parentId')
  if (parentId !== null && !nodeById(open.state, parentId)) return refused('notFound')

  // A move that would close the tree on itself is refused by handing the state back untouched,
  // which without this reads as done.
  return editNode(input, node =>
    canReparent(open.state.nodes, node.id, parentId) ? reparentNode(node.id, parentId) : null,
  )
}

// `editNode`'s twin for the half of the document that belongs to no node. An empty patch is a
// refusal rather than a no-op: a client that named nothing meant something.
function editWorld(build: (world: SceneWorld) => Partial<SceneWorld>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const patch = build(open.state.world)
  if (Object.keys(patch).length === 0) return refused('badInput')

  useScenes.getState().runCommand(open.documentId, setWorld(patch))
  return { ok: true }
}

function worldEnvironment(input: Record<string, unknown>): ActionOutcome {
  const kind = oneOf(input, 'kind', ENVIRONMENT_KINDS)
  const assetId = textOf(input, 'assetId')
  // The panel answers `skybox` by taking the first sky of the project, which from outside would
  // be a reference nobody picked. `studio` beside a sky is the opposite of both readings of it.
  if (kind === 'skybox' && assetId === null) return refused('badInput')
  if (kind === 'studio' && assetId !== null) return refused('badInput')

  const intensity = numberOf(input, 'intensity')
  const rotation = numberOf(input, 'rotation')
  // A sky named outright is a sky chosen, so `kind` is what a client says only to put one out.
  const environment: EnvironmentRef | null =
    assetId !== null ? { kind: 'skybox', assetId } : kind === 'studio' ? STUDIO_ENVIRONMENT : null

  return editWorld(() => ({
    ...(environment === null ? {} : { environment }),
    ...(intensity === null ? {} : { envIntensity: intensity }),
    // Radians, as every other angle a document stores — the panel is what shows degrees.
    ...(rotation === null ? {} : { envRotation: rotation }),
  }))
}

function worldBackground(input: Record<string, unknown>): ActionOutcome {
  const kind = oneOf(input, 'kind', BACKGROUND_KINDS)
  if (!kind) return refused('badInput')
  // `blur` belongs to one shape only, and a key a client believes took must never get a silent
  // yes — the very rule `validatesInput` is written for, one level down.
  if (kind !== 'environment' && input.blur !== undefined) return refused('badInput')
  if (kind !== 'color' && input.color !== undefined) return refused('badInput')

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
  })
}

function worldFog(input: Record<string, unknown>): ActionOutcome {
  const kind = oneOf(input, 'kind', FOG_KINDS)
  if (!kind) return refused('badInput')
  const named = ['color', 'near', 'far', 'density'].filter(key => input[key] !== undefined)
  const belongs =
    kind === 'linear' ? ['color', 'near', 'far'] : kind === 'exp2' ? ['color', 'density'] : []
  if (named.some(key => !belongs.includes(key))) return refused('badInput')

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
  })
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
  })
}

export const SCENE_HANDLERS: ActionHandlers = {
  'scene.state': readState,

  'world.environment': worldEnvironment,
  'world.background': worldBackground,
  'world.fog': worldFog,
  'world.ground': worldGround,

  'world.render': input => {
    const toneMapping = oneOf(input, 'toneMapping', TONE_MAPPINGS)
    const exposure = numberOf(input, 'exposure')

    return editWorld(() => ({
      ...(toneMapping === null ? {} : { toneMapping }),
      ...(exposure === null ? {} : { exposure }),
    }))
  },
  'node.add': add,
  'node.select': select,
  'node.reparent': reparent,

  'node.addModel': input => {
    const assetId = textOf(input, 'assetId') ?? ''
    return place(modelNode(assetId, textOf(input, 'name') ?? assetId))
  },

  'node.remove': input => editNode(input, node => removeNode(node.id)),

  /**
   * The ids in the ORDER they were given: the first is the matter, the rest are the tools. A
   * client that names them in another order asks for another solid, which is what the toolbar
   * does too — see `carveGraph`.
   */
  'node.carve': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const operation = oneOf(input, 'operation', CSG_OPERATIONS)
    const picked = textsOf(input, 'nodeIds')
      .map(id => nodeById(open.state, id))
      .filter(node => node !== null)
    const command = operation && carveNodes(picked, operation, open.state.nodes)
    if (!command) return refused('badInput')

    useScenes.getState().runCommand(open.documentId, command)
    // The id the description promises: a client cannot address the solid otherwise, short of
    // re-reading the whole scene. Read off the state after, since the command mints it.
    const solid = sceneOf(useScenes.getState(), open.documentId).nodes.find(
      node => node.type === 'carved' && !open.state.nodes.includes(node),
    )
    return { ok: true, data: { nodeId: solid?.id ?? '' } }
  },

  'node.separate': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const node = nodeById(open.state, textOf(input, 'nodeId') ?? '')
    if (node?.type !== 'carved') return refused('badInput')

    useScenes.getState().runCommand(open.documentId, separateNode(node))
    // The shapes handed back, as the description promises — their ids are what a client aims at
    // next, and nothing else names them.
    const after = sceneOf(useScenes.getState(), open.documentId)
    const given = after.nodes.filter(one => !open.state.nodes.includes(one)).map(one => one.id)
    return { ok: true, data: { nodeIds: given } }
  },

  'node.rename': input =>
    editNode(input, node => renameNode(node.id, textOf(input, 'name') ?? node.name)),

  'node.visible': input =>
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

      return movesToCommand(
        keying.state,
        [
          {
            id: node.id,
            transform: {
              position: vectorOf(input, 'position', played.position),
              rotation: vectorOf(input, 'rotation', played.rotation),
              scale: vectorOf(input, 'scale', played.scale),
            },
          },
        ],
        keying.at,
        keying.recording,
      )
    }),

  'node.material': input =>
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

  'node.geometry': input =>
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

  'node.shadow': input =>
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

  'node.sprite': input =>
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

  'node.text': input =>
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

  'node.path': input =>
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
    if (aimed.length > 0 && index !== null) return refused('badInput')
    if (aimed.length > 0 && aimed.length < POINT_AXES.length) return refused('badInput')

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

  'model.material': input =>
    editNode(input, node => {
      // The mirror of `node.material`, which refuses a model: a `.glb` carries a finish per
      // material of its own, and what the studio puts over it is this.
      if (node.type !== 'model') return null

      const colour = textOf(input, 'color')
      const roughness = numberOf(input, 'roughness')
      const metalness = numberOf(input, 'metalness')
      if (!colour && roughness === null && metalness === null) return null

      return setModelMaterial(node.id, {
        ...node.model.material,
        ...(colour ? { color: colour } : {}),
        ...(roughness === null ? {} : { roughness }),
        ...(metalness === null ? {} : { metalness }),
      })
    }),

  'model.textures': input =>
    editNode(input, node => {
      if (node.type !== 'model') return null

      const asked = texturesFrom(input)
      if (!asked) return null

      // The whole set, as `setModelTextures` takes it: a slot left out of the record is a slot
      // put back to the map the file itself carries, which is what an empty id says too.
      const textures: ModelRef['textures'] = {}
      for (const slot of TEXTURE_SLOTS) {
        const ref = asked[slot]
        if (ref) textures[slot] = ref
      }

      return setModelTextures(node.id, textures)
    }),

  /**
   * The lens, through the inspector's own translation — `fov` may be keyed, the two distances
   * never are. The lens handed over keeps the fov it ALREADY holds: that value is what its key is
   * measured against, and a new one there moves the rest pose under every other key.
   */
  'node.camera': input =>
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
  'camera.shot': input => openShot(input),

  // Through the very command the inspector's own select goes through, so a rail bound from here
  // takes the whole of itself forwards exactly as one bound on screen does.
  'camera.rail': input =>
    editShot(input, (shot, state) => {
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
    }),

  // Through the panel's own command, which lays the rail AND binds it in one entry: a rail added
  // without its shot would be a line nothing runs on.
  'camera.addRail': input =>
    editShot(input, (shot, state) => {
      const camera = nodeById(state, shot.cameraId)
      return camera?.type === 'camera' ? railForShot(camera, shot) : null
    }),

  'camera.reorder': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const nodeId = textOf(input, 'nodeId') ?? ''
    // `shotsWithCameraMoved` answers `null` for a camera with no line on the band, and reports
    // the steps it could actually take — a line already at the top moves by none.
    const moved = shotsWithCameraMoved(
      open.state.animation.shots,
      nodeId,
      numberOf(input, 'by') ?? 0,
    )
    if (!moved || moved.steps === 0) return refused('badInput')

    useScenes.getState().runCommand(open.documentId, reorderCameraShots(nodeId, moved.shots))
    return { ok: true, data: { steps: moved.steps } }
  },

  'camera.target': input =>
    editShot(input, (shot, state) => {
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
    }),

  // A field the shape has no room for is refused rather than filed: `withField` writes by
  // computed key without checking, and a light given a `penumbra` it never had is a document
  // that no longer describes anything.
  'node.light': input =>
    editNode(input, node => {
      if (node.type !== 'light') return null

      const specs: Specs = LIGHT_SPECS[node.light.kind]
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

        if (!withinSpec(specs[name], value)) return null
        light = withField(light, name, value)
      }

      if ('target' in node.light && TARGET_AXES.some(axis => input[axis] !== undefined)) {
        light = withField(light, 'target', vectorOf(input, 'target', node.light.target))
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
    if (!open) return refused('wrongSurface')
    if (!direction) return refused('badInput')

    // A side to look from is a MOVE, not a state — see `PaneView` — so it goes to the engine.
    const engine = sceneEngineOf(open.documentId)
    if (!engine) return refused('wrongSurface')

    engine.viewFrom(direction)
    return { ok: true }
  },

  // The same function the menu row and the keyboard go through, which answers whether the still
  // landed: a viewport that is not mounted is a silence the row can live with and a client cannot.
  'scene.capture': async input => {
    const open = mounted()
    const quality = oneOf(input, 'quality', CAPTURE_QUALITIES) ?? DEFAULT_CAPTURE_QUALITY
    if (!open) return refused('wrongSurface')

    return (await captureSceneView(open.documentId, quality)) ? { ok: true } : refused('failed')
  },

  'world.preset': input => {
    const preset = oneOf(input, 'preset', ENVIRONMENT_PRESETS)
    return preset === null ? refused('badInput') : editWorld(() => presetPatch(preset))
  },

  'view.display': input => {
    const open = mounted()
    const mode = oneOf(input, 'mode', DISPLAY_MODES)
    if (!open) return refused('wrongSurface')
    if (!mode) return refused('badInput')

    useSceneViews.getState().setDisplay(open.documentId, MAIN_SCENE_PANE, mode)
    return { ok: true }
  },
}
