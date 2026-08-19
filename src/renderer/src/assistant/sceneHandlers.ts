import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { readColor } from '@shared/domain/color'
import type { Vector3 } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import {
  addNode,
  removeNode,
  renameNode,
  reparentNode,
  setCamera,
  setLight,
  setMeshMaterial,
  setNodeVisible,
  setSelection,
  setTransform,
} from '@/engines/scene/commands'
import { EASINGS, POINT_TARGET, type CameraShot } from '@shared/domain/animation'
import { addCameraShot, bindRailToShot, editCameraShot } from '@/engines/scene/animationCommands'
import { newShotAt } from '@/engines/scene/cameraShots'
import { newId } from '@/helpers/ids'
import type { Command } from '@/engines/core/history'
import { createNodeOf, modelNode } from '@/engines/scene/nodeFactory'
import { canReparent, nodeById, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { type ActionHandlers } from './actionHandler'
import { boolOf, numberOf, textOf, textsOf } from './actionInputs'

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
  build: (node: SceneNode) => Command<SceneState> | null,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const node = nodeById(open.state, textOf(input, 'nodeId') ?? '')
  const command = node && build(node)
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

function readState(): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      documentId: open.documentId,
      selectedIds: open.state.selectedIds,
      environment: open.state.environment,
      // What drives the cameras: without them a client can open a shot and never edit one, since
      // `camera.rail` and `camera.target` name it by the id only this list hands over.
      shots: open.state.animation.shots,
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
      })),
    },
  }
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

export const SCENE_HANDLERS: ActionHandlers = {
  'scene.state': readState,
  'node.add': add,
  'node.select': select,
  'node.reparent': reparent,

  'node.addModel': input => {
    const assetId = textOf(input, 'assetId') ?? ''
    return place(modelNode(assetId, textOf(input, 'name') ?? assetId))
  },

  'node.remove': input => editNode(input, node => removeNode(node.id)),

  'node.rename': input =>
    editNode(input, node => renameNode(node.id, textOf(input, 'name') ?? node.name)),

  'node.visible': input =>
    editNode(input, node => setNodeVisible(node.id, boolOf(input, 'visible'))),

  'node.transform': input =>
    editNode(input, node =>
      setTransform(node.id, {
        position: vectorOf(input, 'position', node.transform.position),
        // Radians in the state and radians here: unlike a layer's single angle, three Euler
        // angles in degrees would have to be converted back for every read of `scene.state`.
        rotation: vectorOf(input, 'rotation', node.transform.rotation),
        scale: vectorOf(input, 'scale', node.transform.scale),
      }),
    ),

  // Text wears the same material as a mesh, but `setMeshMaterial` writes only a mesh's — the two
  // are separate commands, so a text node here would be a silent no-op.
  'node.material': input =>
    editNode(input, node =>
      node.type !== 'mesh'
        ? null
        : setMeshMaterial(node.id, {
            ...node.material,
            color: readColor(input, 'color', node.material.color ?? ''),
            roughness: numberOf(input, 'roughness') ?? node.material.roughness,
            metalness: numberOf(input, 'metalness') ?? node.material.metalness,
          }),
    ),

  'node.camera': input =>
    editNode(input, node =>
      node.type !== 'camera'
        ? null
        : setCamera(node.id, {
            fov: numberOf(input, 'fov') ?? node.camera.fov,
            near: numberOf(input, 'near') ?? node.camera.near,
            far: numberOf(input, 'far') ?? node.camera.far,
          }),
    ),

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

  'node.light': input =>
    editNode(input, node => {
      if (node.type !== 'light') return null
      const intensity = numberOf(input, 'intensity')

      return setLight(node.id, {
        ...node.light,
        // A hemisphere light has no `color` at all — a sky and a ground colour instead — so the
        // field is written only where the kind carries one.
        ...('color' in node.light ? { color: readColor(input, 'color', node.light.color) } : {}),
        ...(intensity === null ? {} : { intensity }),
      })
    }),
}
