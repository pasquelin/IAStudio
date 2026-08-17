import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { readColor } from '@shared/domain/color'
import type { Vector3 } from '@shared/domain/scene'
import {
  addNode,
  removeNode,
  renameNode,
  reparentNode,
  setLight,
  setMeshMaterial,
  setNodeVisible,
  setSelection,
  setTransform,
} from '@/engines/scene/commands'
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
      })),
    },
  }
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
