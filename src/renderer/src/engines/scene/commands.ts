import { composed, type Command } from '../core/history'
import type { Rig } from '@shared/domain/rig'
import {
  isVector3,
  type ClipRef,
  type EnvironmentRef,
  type GeometryDescriptor,
  type LightDescriptor,
  type MaterialDescriptor,
  type ModelRef,
  type SpriteDescriptor,
  type TextDescriptor,
  type Transform,
} from '@shared/domain/scene'
import { isRecord } from '@shared/guards'
import { changedFields } from '@/helpers/objects'
import { applySelection, type SelectionMode } from '@/helpers/selection'
import { withField, type FieldValue } from './propertyFields'
import { newId } from '@/helpers/ids'
import { groupNode } from './nodeFactory'
import {
  canCastShadow,
  canReceiveShadow,
  canReparent,
  hasChildren,
  nodeById,
  rotationShows,
  subtreeOf,
  type SceneNodeBase,
  type SceneNodeType,
  type MeshNode,
  type NodeMove,
  type SceneNode,
  type SceneState,
} from './sceneState'

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
  return addNodes([node])
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
 *
 * What to write may be a function of the node and the scene around it, which only `apply` holds:
 * a command is built before it runs and replayed on redo, so a rule about the scene has to be
 * read at each `apply` rather than frozen into the closure.
 */
function editNode(
  label: string,
  id: string,
  changes: NodePatch | ((node: SceneNode, state: SceneState) => NodePatch),
): Command<SceneState> {
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
      return patch(state, id, typeof changes === 'function' ? changes(node, state) : changes)
    },
    revert: state => (previous ? patch(state, id, previous) : state),
  }
}

/**
 * Where a node stands, how it is turned and how big it is.
 *
 * An angle `rotationShows` refuses is dropped, and the rest of the move written: the value would
 * sit in the document and cost an undo without the screen ever moving. Dropped rather than the
 * whole edit refused — a pivot drag over a mixed selection carries the sprite through space, and
 * *that* shows.
 */
export function setTransform(id: string, next: Transform): Command<SceneState> {
  return editNode('transform', id, (node, state) => ({
    transform: rotationShows(node, () => hasChildren(state.nodes, id))
      ? next
      : { ...next, rotation: node.transform.rotation },
  }))
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

/** A light catches nothing, one without a shadow camera throws nothing, a sprite does neither. */
function refuses(node: SceneNode, changes: ShadowPatch): boolean {
  if (changes.receiveShadow !== undefined && !canReceiveShadow(node)) return true
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
      return patchPart(state, id, 'mesh', changes)
    },
    revert: state => (previous ? patchPart(state, id, 'mesh', previous) : state),
  }
}

export function setGeometry(id: string, geometry: GeometryDescriptor): Command<SceneState> {
  return editMesh('geometry', id, { geometry })
}

export function setMeshMaterial(id: string, material: MaterialDescriptor): Command<SceneState> {
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
      return patchPart(state, id, 'light', { light })
    },
    revert: state => (previous ? patchPart(state, id, 'light', { light: previous }) : state),
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

/**
 * The discriminated half of one node, replaced. Keyed by `type` as well as by id: `type` is what
 * forbids a light from holding a geometry, and a node of another kind is left alone rather than
 * given a field its shape has no room for.
 */
function patchPart<T extends SceneNodeType>(
  state: SceneState,
  id: string,
  type: T,
  changes: Partial<Omit<Extract<SceneNode, { type: T }>, keyof SceneNodeBase | 'type'>>,
): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === id && node.type === type ? { ...node, ...changes } : node,
    ),
  }
}

/** One entry in the history for what the user did in one gesture — see `composed`. */
export function multi(id: string, commands: Command<SceneState>[]): Command<SceneState> {
  return composed(id, commands)
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
 *
 * Keeps the bare shape beside `setMeshMaterial`, and that is a decision: only ONE engine
 * publishes this name, so nothing can auto-import the wrong one. A domain is added the day a
 * second claims the word — never for symmetry with a neighbour that needed it.
 */
export function setMaterialOn(
  nodes: readonly SceneNode[],
  changes: Partial<MaterialDescriptor>,
): Command<SceneState> {
  return batch('material', nodes, node => {
    // A text is lit exactly as a mesh is, and wears the same descriptor — so one section of the
    // inspector serves both, and neither has to know the other exists.
    if (node.type === 'mesh') return setMeshMaterial(node.id, { ...node.material, ...changes })
    if (node.type === 'text') return setTextMaterial(node.id, { ...node.material, ...changes })
    return null
  })
}

/**
 * The sprite's own parameters. A node of another type is left alone rather than patched, exactly
 * as `editMesh` refuses to give a light a geometry.
 */
export function setSprite(id: string, sprite: SpriteDescriptor): Command<SceneState> {
  let previous: SpriteDescriptor | null = null

  return {
    id: `sprite:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'sprite') return state
      previous = node.sprite
      return patchPart(state, id, 'sprite', { sprite })
    },
    revert: state => (previous ? patchPart(state, id, 'sprite', { sprite: previous }) : state),
  }
}

/**
 * What an imported model plays, in the order the band draws it. An empty list puts it back to its
 * rest pose.
 *
 * The whole list is written rather than one block patched, for the reason `setModelTextures`
 * states: what the inspector holds IS the list, and a partial write would leave the revert unable
 * to say which blocks it was answering for.
 */
export function setModelClips(id: string, clips: readonly ClipRef[]): Command<SceneState> {
  return editModel(id, 'clips', model => {
    const rest = { ...model }
    delete rest.clips
    return clips.length > 0 ? { ...rest, clips } : rest
  })
}

/** The skeleton put on a model, or none. Undo comes for free, which is why a rig is a document's. */
export function setModelRig(id: string, rig: Rig | null): Command<SceneState> {
  return editModel(id, 'rig', model => {
    const rest = { ...model }
    delete rest.rig
    return rig ? { ...rest, rig } : rest
  })
}

/**
 * The project's own maps over the ones the model's file carries. An empty record puts every slot
 * back to what the file brought.
 *
 * The whole set is written rather than one slot patched, for the reason `setMaterialOn` states
 * about a descriptor: what the inspector holds IS the set, and a partial write would leave the
 * revert unable to say which slots it was answering for.
 */
export function setModelTextures(id: string, textures: ModelRef['textures']): Command<SceneState> {
  return editModel(id, 'textures', model => {
    const rest = { ...model }
    delete rest.textures
    // An empty set is « the file's own maps », which is what a document says by holding no field.
    return textures && Object.keys(textures).length > 0 ? { ...rest, textures } : rest
  })
}

/**
 * One field of a model's reference, with the rest of it carried over. Written once because the
 * carrying is the whole point: an edit that rebuilt the reference from `assetId` alone dropped
 * every other field a model holds — which is how a texture override vanished on the next play.
 */
function editModel(
  id: string,
  edited: string,
  next: (model: ModelRef) => ModelRef,
): Command<SceneState> {
  let previous: ModelRef | null = null

  return {
    id: `${edited}:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'model') return state
      previous = node.model
      return patchPart(state, id, 'model', { model: next(node.model) })
    },
    revert: state => (previous ? patchPart(state, id, 'model', { model: previous }) : state),
  }
}

/**
 * The words, the face and the three numbers that shape them. A node of another type is left
 * alone rather than patched, exactly as `editMesh` refuses to give a light a geometry.
 */
export function setText(id: string, text: TextDescriptor): Command<SceneState> {
  let previous: TextDescriptor | null = null

  return {
    id: `text:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'text') return state
      previous = node.text
      return patchPart(state, id, 'text', { text })
    },
    revert: state => (previous ? patchPart(state, id, 'text', { text: previous }) : state),
  }
}

/** The material a text wears — the same descriptor a mesh does, on the other node type. */
export function setTextMaterial(id: string, material: MaterialDescriptor): Command<SceneState> {
  let previous: MaterialDescriptor | null = null

  return {
    id: `material:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'text') return state
      previous = node.material
      return patchPart(state, id, 'text', { material })
    },
    revert: state => (previous ? patchPart(state, id, 'text', { material: previous }) : state),
  }
}

/** The same, spread over a selection — the text counterpart of `setMaterialOn`. */
export function setTextOn(
  nodes: readonly SceneNode[],
  changes: Partial<TextDescriptor>,
): Command<SceneState> {
  return batch('text', nodes, node =>
    node.type === 'text' ? setText(node.id, { ...node.text, ...changes }) : null,
  )
}

/** The same, spread over a selection — the sprite counterpart of `setMaterialOn`. */
export function setSpriteOn(
  nodes: readonly SceneNode[],
  changes: Partial<SpriteDescriptor>,
): Command<SceneState> {
  return batch('sprite', nodes, node =>
    node.type === 'sprite' ? setSprite(node.id, { ...node.sprite, ...changes }) : null,
  )
}

/**
 * Hangs a node from another, or from the scene when the parent is `null`.
 *
 * The old parent is captured **as the command runs**, like every other edit here: what a node
 * hung from before is only known once the move actually happens, and a redo has to re-capture.
 *
 * A move that would close the tree on itself is refused rather than applied — see `canReparent`.
 */
export function reparentNode(id: string, parentId: string | null): Command<SceneState> {
  let previous: string | null = null
  let moved = false

  return {
    id: `reparent:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (!node || node.parentId === parentId || !canReparent(state.nodes, id, parentId)) {
        moved = false
        return state
      }

      previous = node.parentId
      moved = true
      return hang(state, id, parentId)
    },
    revert: state => (moved ? hang(state, id, previous) : state),
  }
}

/**
 * Puts a group over the selected nodes, and hangs them from it.
 *
 * Only the roots of the selection move: a node whose own parent is selected too is already
 * carried along, and moving it as well would flatten the subtree it was part of.
 *
 * The group lands where the selection already lived when they share a parent, and at the scene
 * when they do not: grouping two children of a group must not lift them out of it.
 */
export function groupNodes(nodes: readonly SceneNode[]): Command<SceneState> {
  const selected = new Set(nodes.map(node => node.id))
  const roots = nodes.filter(node => node.parentId === null || !selected.has(node.parentId))
  const shared = roots.every(node => node.parentId === roots[0]?.parentId)
  const group = { ...groupNode(), parentId: shared ? (roots[0]?.parentId ?? null) : null }

  return multi(commandId('group', [group.id]), [
    addNode(group),
    ...roots.map(node => reparentNode(node.id, group.id)),
  ])
}

function hang(state: SceneState, id: string, parentId: string | null): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node => (node.id === id ? { ...node, parentId } : node)),
  }
}

/**
 * Copies of the given nodes, with fresh ids and their parents rewritten to point at the copies.
 *
 * A subtree is duplicated whole: copying a group has to copy what hangs from it, and a child
 * whose `parentId` still named the original would end up shared between the two — moving one
 * would move the other's child. What falls outside the set keeps its parent, which is what puts
 * a copy beside its original rather than at the root.
 */
export function copiesOf(nodes: readonly SceneNode[], picked: readonly SceneNode[]): SceneNode[] {
  const carried = picked.flatMap(node => subtreeOf(nodes, node.id))
  const fresh = [...new Map(carried.map(node => [node.id, node])).values()].map(node => ({
    node,
    id: newId(),
  }))
  const renamed = new Map(fresh.map(({ node, id }) => [node.id, id]))

  return fresh.map(({ node, id }) => ({
    ...node,
    id,
    parentId: node.parentId === null ? null : (renamed.get(node.parentId) ?? node.parentId),
  }))
}

/**
 * The same copies, with any parent the destination does not hold cut loose.
 *
 * `copiesOf` keeps a parent that falls outside the set, which is what lands a duplicate beside
 * its original. Pasted into another scene, that parent names nothing: the outliner drops a node
 * whose parent is missing while the viewport still draws it, and it becomes unreachable.
 */
export function rootedIn(
  copies: readonly SceneNode[],
  nodes: readonly SceneNode[],
): readonly SceneNode[] {
  const known = new Set([...nodes, ...copies].map(node => node.id))

  return copies.map(copy =>
    copy.parentId !== null && !known.has(copy.parentId) ? { ...copy, parentId: null } : copy,
  )
}

/**
 * Puts copies of the given nodes into the scene, and selects them — what was just made is what
 * the next gesture acts on, in every editor there is.
 */
export function addNodes(copies: readonly SceneNode[]): Command<SceneState> {
  return {
    id: commandId(
      'add',
      copies.map(node => node.id),
    ),
    // Nothing to put down clears no selection: an empty add is a no-op, not a deselect.
    apply: state =>
      copies.length === 0
        ? state
        : {
            ...state,
            nodes: [...state.nodes, ...copies],
            selectedIds: copies.map(copy => copy.id),
          },
    revert: state => ({
      ...state,
      nodes: state.nodes.filter(node => !copies.some(copy => copy.id === node.id)),
      selectedIds: copies.reduce((ids, copy) => deselect(ids, copy.id), state.selectedIds),
    }),
  }
}

/** Deleting a selection is one gesture, so it is one entry in the history. */
export function removeNodes(
  nodes: readonly SceneNode[],
  ids: readonly string[],
): Command<SceneState> {
  // The whole subtree, not the picked rows: a child left behind would hang from a parent the
  // scene no longer holds, and `flattenTree` drops an orphan rather than promoting it.
  const doomed = [...new Set(ids.flatMap(id => subtreeOf(nodes, id).map(node => node.id)))]
  return multi(commandId('remove', ids), doomed.map(removeNode))
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
