import type { Command } from '../core/history'
import type {
  EnvironmentRef,
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  Transform,
} from '@shared/domain/scene'
import { isRecord } from '@shared/guards'
import { changedFields } from '@/helpers/objects'
import { applySelection, type SelectionMode } from '@/helpers/selection'
import { isVector3, withField, type FieldValue } from './property-fields'
import {
  canCastShadow,
  nodeById,
  type MeshNode,
  type NodeMove,
  type SceneNode,
  type SceneState,
} from './scene-state'

/**
 * Scene edits, reimplemented in TypeScript from `mrdoob/three.js/editor/js/commands/` (MIT).
 * The structure is what was worth taking; the original is untyped JavaScript built on its own
 * `signals` bus.
 *
 * A command captures what it needs to revert **as it is applied**, not as it is built: what an
 * object looked like before is only known once the edit actually runs. Redo re-applies and
 * re-captures, so a command survives being replayed.
 */
export function addNode(node: SceneNode): Command<SceneState> {
  return {
    id: `add:${node.id}`,
    apply: state => ({ ...state, nodes: [...state.nodes, node], selectedIds: [node.id] }),
    revert: state => ({
      ...state,
      nodes: state.nodes.filter(candidate => candidate.id !== node.id),
      selectedIds: deselect(state.selectedIds, node.id),
    }),
  }
}

export function removeNode(id: string): Command<SceneState> {
  let removed: SceneNode | null = null
  let index = -1

  return {
    id: `remove:${id}`,
    apply: state => {
      index = state.nodes.findIndex(node => node.id === id)
      if (index < 0) return state
      removed = state.nodes[index] ?? null
      return {
        ...state,
        nodes: state.nodes.filter(node => node.id !== id),
        selectedIds: deselect(state.selectedIds, id),
      }
    },
    revert: state => {
      if (!removed || index < 0) return state
      const nodes = [...state.nodes]
      // Back at its original index: re-appending would silently reorder the outliner.
      nodes.splice(index, 0, removed)
      return { ...state, nodes }
    },
  }
}

/**
 * One shape for every edit of a shared field: they all revert by putting the old values back.
 * The whole shared set is captured rather than the single field touched — the history is a
 * linear stack, so nothing can change the node between `apply` and `revert`.
 */
function editNode(label: string, id: string, changes: NodePatch): Command<SceneState> {
  let previous: NodePatch | null = null

  return {
    id: `${label}:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (!node) return state
      previous = {
        name: node.name,
        visible: node.visible,
        transform: node.transform,
        castShadow: node.castShadow,
        receiveShadow: node.receiveShadow,
      }
      return patch(state, id, changes)
    },
    revert: state => (previous ? patch(state, id, previous) : state),
  }
}

export function setTransform(id: string, next: Transform): Command<SceneState> {
  return editNode('transform', id, { transform: next })
}

export function setNodeVisible(id: string, visible: boolean): Command<SceneState> {
  return editNode('visible', id, { visible })
}

export function renameNode(id: string, name: string): Command<SceneState> {
  return editNode('rename', id, { name })
}

/**
 * Whether the selected nodes throw a shadow, or catch the ones others throw.
 *
 * A light catches nothing, so it is skipped rather than given a flag the renderer would ignore:
 * with a mesh and a light selected together, the inspector hides the row but the command would
 * otherwise still write it into the document and into the history.
 */
export function setShadowOn(
  nodes: readonly SceneNode[],
  changes: ShadowPatch,
): Command<SceneState> {
  return batch('shadow', nodes, node =>
    refuses(node, changes) ? null : editNode('shadow', node.id, changes),
  )
}

type ShadowPatch = Partial<Pick<SceneNode, 'castShadow' | 'receiveShadow'>>

/** A light catches nothing, and one without a shadow camera throws nothing either. */
function refuses(node: SceneNode, changes: ShadowPatch): boolean {
  if (changes.receiveShadow !== undefined && node.type === 'light') return true
  return changes.castShadow !== undefined && !canCastShadow(node)
}

/**
 * The discriminated half of a node, edited. A node of the other type is left alone rather than
 * patched: `type` is what forbids a light from holding a geometry, and an edit that wrote one
 * anyway would produce a document that no longer loads.
 */
function editMesh(label: string, id: string, changes: MeshPatch): Command<SceneState> {
  let previous: MeshPatch | null = null

  return {
    id: `${label}:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'mesh') return state
      previous = { geometry: node.geometry, material: node.material }
      return patchMesh(state, id, changes)
    },
    revert: state => (previous ? patchMesh(state, id, previous) : state),
  }
}

export function setGeometry(id: string, geometry: GeometryDescriptor): Command<SceneState> {
  return editMesh('geometry', id, { geometry })
}

export function setMaterial(id: string, material: MaterialDescriptor): Command<SceneState> {
  return editMesh('material', id, { material })
}

export function setLight(id: string, light: LightDescriptor): Command<SceneState> {
  let previous: LightDescriptor | null = null

  return {
    id: `light:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'light') return state
      previous = node.light
      return patchLight(state, id, light)
    },
    revert: state => (previous ? patchLight(state, id, previous) : state),
  }
}

/**
 * Only the fields every node shares: patching a discriminated field would let a light take a
 * geometry, which is exactly what the union exists to forbid.
 */
type NodePatch = Partial<
  Pick<SceneNode, 'name' | 'visible' | 'transform' | 'castShadow' | 'receiveShadow'>
>

function patch(state: SceneState, id: string, changes: NodePatch): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node => (node.id === id ? { ...node, ...changes } : node)),
  }
}

type MeshPatch = Partial<Pick<MeshNode, 'geometry' | 'material'>>

function patchMesh(state: SceneState, id: string, changes: MeshPatch): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === id && node.type === 'mesh' ? { ...node, ...changes } : node,
    ),
  }
}

function patchLight(state: SceneState, id: string, light: LightDescriptor): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === id && node.type === 'light' ? { ...node, light } : node,
    ),
  }
}

/** One entry in the history for what the user did in one gesture. */
export function multi(id: string, commands: Command<SceneState>[]): Command<SceneState> {
  return {
    id,
    apply: state => commands.reduce((current, command) => command.apply(current), state),
    revert: state =>
      [...commands].reverse().reduce((current, command) => command.revert(current), state),
  }
}

/**
 * The same edit run over a selection, as one entry in the history: three nodes nudged together
 * must cost one ⌘Z, not three. A node the edit does not apply to answers `null` and is skipped.
 *
 * The id names the nodes rather than the count, so a gesture that keeps editing the same
 * selection keeps coalescing — and a selection of one produces the very id the single-node
 * command would have, which is what leaves the common case untouched.
 */
export function batch<T extends { id: string }>(
  label: string,
  targets: readonly T[],
  make: (target: T) => Command<SceneState> | null,
): Command<SceneState> {
  return multi(
    commandId(
      label,
      targets.map(target => target.id),
    ),
    targets.flatMap(target => make(target) ?? []),
  )
}

/**
 * A geometry parameter typed into the inspector, written onto every selected mesh built from the
 * same primitive. A box has no radius, and `withField` writes by computed key without checking —
 * so a node of another kind is left alone rather than silently given a field it never had.
 */
export function setGeometryOn(
  nodes: readonly SceneNode[],
  anchor: GeometryDescriptor,
  name: string,
  value: FieldValue,
): Command<SceneState> {
  return batch('geometry', nodes, node =>
    node.type === 'mesh' && node.geometry.kind === anchor.kind
      ? setGeometry(
          node.id,
          withField(node.geometry, name, spread(anchor, node.geometry, name, value)),
        )
      : null,
  )
}

/** The same, for a light. Kinds differ in what they even have to set. */
export function setLightOn(
  nodes: readonly SceneNode[],
  anchor: LightDescriptor,
  name: string,
  value: FieldValue,
): Command<SceneState> {
  return batch('light', nodes, node =>
    node.type === 'light' && node.light.kind === anchor.kind
      ? setLight(node.id, withField(node.light, name, spread(anchor, node.light, name, value)))
      : null,
  )
}

/**
 * The value to write on one node of a selection. A vector field reports all three axes though the
 * user moved one, so only the axes that differ from the anchor's are carried — otherwise nudging
 * the X of a spot's target would drop every other spot's Y and Z onto the anchor's.
 */
function spread(anchor: object, target: object, name: string, value: FieldValue): FieldValue {
  if (!isVector3(value)) return value

  const before = readField(anchor, name)
  const here = readField(target, name)
  if (!isVector3(before) || !isVector3(here)) return value
  return { ...here, ...changedFields(before, value) }
}

function readField(descriptor: object, name: string): unknown {
  return isRecord(descriptor) ? descriptor[name] : undefined
}

/**
 * Material fields onto every selected mesh. Only what the inspector moved is carried: the whole
 * descriptor would take the anchor's texture slots with it, onto meshes that never showed them.
 */
export function setMaterialOn(
  nodes: readonly SceneNode[],
  changes: Partial<MaterialDescriptor>,
): Command<SceneState> {
  return batch('material', nodes, node =>
    node.type === 'mesh' ? setMaterial(node.id, { ...node.material, ...changes }) : null,
  )
}

/** Deleting a selection is one gesture, so it is one entry in the history. */
export function removeNodes(ids: readonly string[]): Command<SceneState> {
  return multi(commandId('remove', ids), ids.map(removeNode))
}

/** Where a drag left every node it carried. One drag, one entry, however many nodes moved. */
export function moveNodes(moves: readonly NodeMove[]): Command<SceneState> {
  return batch('transform', moves, move => setTransform(move.id, move.transform))
}

/**
 * One convention for what a history entry is called, in one place: the coalescing of a gesture
 * turns on two consecutive commands sharing an id, and a format that drifted by a character
 * would break it silently — a drag would cost one undo per frame.
 */
function commandId(label: string, ids: readonly string[]): string {
  return `${label}:${ids.join(',')}`
}

/**
 * What lights the scene. In the history like any other edit of the document: choosing a sky is a
 * decision about the scene, and ⌘Z has to take it back like the rest.
 */
export function setEnvironment(environment: EnvironmentRef): Command<SceneState> {
  let previous: EnvironmentRef | null = null

  return {
    id: 'environment',
    apply: state => {
      previous = state.environment
      return { ...state, environment }
    },
    revert: state => (previous ? { ...state, environment: previous } : state),
  }
}

/** Selection stays out of the history: nobody wants ⌘Z to give them back a selection. */
export function setSelection(
  state: SceneState,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): SceneState {
  return { ...state, selectedIds: applySelection(state.selectedIds, ids, mode) }
}

/** Identity kept when nothing was selected: a delete elsewhere must not re-render every panel. */
function deselect(ids: readonly string[], id: string): readonly string[] {
  return applySelection(ids, ids.includes(id) ? [id] : [], 'toggle')
}
