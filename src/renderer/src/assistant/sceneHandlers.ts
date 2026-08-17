import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
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
import { createNodeOf, modelNode } from '@/engines/scene/nodeFactory'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import type { Command } from '@/engines/core/history'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import type { ActionHandlers } from './actionHandler'
import { boolOf, numberOf, textOf, textsOf } from './actionInputs'

/**
 * The scene graph, driven by value.
 *
 * Every node enters through `createNodeOf`, the same factory the Add menu and the native menu
 * go through — a second way of building a box is a second set of defaults to keep in step.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

function sceneId(): string | null {
  return activeSceneId(useDocuments.getState())
}

function stateOf(documentId: string): SceneState {
  return sceneOf(useScenes.getState(), documentId)
}

function findNode(documentId: string, nodeId: string): SceneNode | null {
  return stateOf(documentId).nodes.find(node => node.id === nodeId) ?? null
}

/** Runs one command against the scene in front, the node it names having been found first. */
function edit(
  nodeId: string | null,
  build: (documentId: string) => Command<SceneState>,
): ActionOutcome {
  const documentId = sceneId()
  if (!documentId) return refused('wrongSurface')
  if (nodeId !== null && !findNode(documentId, nodeId)) return refused('badInput')

  useScenes.getState().runCommand(documentId, build(documentId))
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

/** `#rrggbb` in, the same string out — the descriptors store colours as CSS, not as packed ints. */
function colourOf(input: Record<string, unknown>): string | null {
  const written = textOf(input, 'color')
  return written !== null && /^#[0-9a-f]{6}$/i.test(written) ? written : null
}

function readState(): ActionOutcome {
  const documentId = sceneId()
  if (!documentId) return refused('wrongSurface')

  const state = stateOf(documentId)
  return {
    ok: true,
    data: {
      documentId,
      selectedIds: state.selectedIds,
      environment: state.environment,
      // The flat list the state itself holds — the tree is derived from `parentId`, and handing
      // one over would be a second shape of the same thing for a client to walk.
      nodes: state.nodes.map(node => ({
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

function add(input: Record<string, unknown>): ActionOutcome {
  const kind = textOf(input, 'kind')
  if (kind === null) return refused('badInput')

  const node = createNodeOf(kind)
  // A kind no registry declares. The factory answers `null` rather than throwing, so this is
  // where it becomes a refusal instead of a node that never arrived.
  if (!node) return refused('badInput')

  const placed: SceneNode = {
    ...node,
    name: textOf(input, 'name') ?? node.name,
    transform: {
      ...node.transform,
      position: vectorOf(input, 'position', node.transform.position),
    },
  }

  const outcome = edit(null, () => addNode(placed))
  return outcome.ok ? { ok: true, data: { nodeId: placed.id } } : outcome
}

function addModel(input: Record<string, unknown>): ActionOutcome {
  const assetId = textOf(input, 'assetId')
  if (assetId === null) return refused('badInput')

  const node = modelNode(assetId, textOf(input, 'name') ?? assetId)
  const outcome = edit(null, () => addNode(node))
  return outcome.ok ? { ok: true, data: { nodeId: node.id } } : outcome
}

function transform(input: Record<string, unknown>): ActionOutcome {
  const nodeId = textOf(input, 'nodeId')
  const documentId = sceneId()
  if (nodeId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')

  const current = findNode(documentId, nodeId)?.transform
  if (!current) return refused('badInput')

  return edit(nodeId, () =>
    setTransform(nodeId, {
      position: vectorOf(input, 'position', current.position),
      // Radians in the state, and radians here: unlike a layer's single angle, three Euler
      // angles in degrees would have to be converted back for every read of `scene.state`.
      rotation: vectorOf(input, 'rotation', current.rotation),
      scale: vectorOf(input, 'scale', current.scale),
    }),
  )
}

function material(input: Record<string, unknown>): ActionOutcome {
  const nodeId = textOf(input, 'nodeId')
  const documentId = sceneId()
  if (nodeId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')

  const node = findNode(documentId, nodeId)
  // Text wears the same material as a mesh, and `setMeshMaterial` writes only a mesh's — the
  // two are separate commands, so a text node here would be a silent no-op.
  if (node?.type !== 'mesh') return refused('badInput')

  const colour = colourOf(input)
  return edit(nodeId, () =>
    setMeshMaterial(nodeId, {
      ...node.material,
      ...(colour === null ? {} : { color: colour }),
      roughness: numberOf(input, 'roughness') ?? node.material.roughness,
      metalness: numberOf(input, 'metalness') ?? node.material.metalness,
    }),
  )
}

function light(input: Record<string, unknown>): ActionOutcome {
  const nodeId = textOf(input, 'nodeId')
  const documentId = sceneId()
  if (nodeId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')

  const node = findNode(documentId, nodeId)
  if (node?.type !== 'light') return refused('badInput')

  const colour = colourOf(input)
  const intensity = numberOf(input, 'intensity')
  return edit(nodeId, () =>
    setLight(nodeId, {
      ...node.light,
      // A hemisphere light has no `color` at all — two of its own instead — so the field is
      // written only where the kind carries one.
      ...(colour !== null && 'color' in node.light ? { color: colour } : {}),
      ...(intensity === null ? {} : { intensity }),
    }),
  )
}

function select(input: Record<string, unknown>): ActionOutcome {
  const documentId = sceneId()
  if (!documentId) return refused('wrongSurface')

  const nodeIds = textsOf(input, 'nodeIds')
  const known = stateOf(documentId).nodes.map(node => node.id)
  if (nodeIds.some(id => !known.includes(id))) return refused('badInput')

  // Selection is not a command: it stays out of the history, so `replace` writes the state.
  const store = useScenes.getState()
  store.replace(documentId, setSelection(stateOf(documentId), nodeIds))
  return { ok: true }
}

function reparent(input: Record<string, unknown>): ActionOutcome {
  const nodeId = textOf(input, 'nodeId')
  const parentId = textOf(input, 'parentId')
  const documentId = sceneId()
  if (nodeId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')
  if (parentId !== null && !findNode(documentId, parentId)) return refused('badInput')

  return edit(nodeId, () => reparentNode(nodeId, parentId))
}

export const SCENE_HANDLERS: ActionHandlers = {
  'scene.state': readState,
  'node.add': add,
  'node.addModel': addModel,
  'node.remove': input => {
    const nodeId = textOf(input, 'nodeId')
    return nodeId === null ? refused('badInput') : edit(nodeId, () => removeNode(nodeId))
  },
  'node.rename': input => {
    const nodeId = textOf(input, 'nodeId')
    const name = textOf(input, 'name')
    return nodeId === null || name === null
      ? refused('badInput')
      : edit(nodeId, () => renameNode(nodeId, name))
  },
  'node.transform': transform,
  'node.visible': input => {
    const nodeId = textOf(input, 'nodeId')
    return nodeId === null
      ? refused('badInput')
      : edit(nodeId, () => setNodeVisible(nodeId, boolOf(input, 'visible')))
  },
  'node.material': material,
  'node.light': light,
  'node.reparent': reparent,
  'node.select': select,
}
