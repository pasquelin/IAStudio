import { commandId, composed, type Command } from '../core/history'
import { bringsSecondPlayer, leavesPlayerModule, tearsPlayerApart } from './playerModule'
import {
  clipLane,
  isVector3,
  MAIN_LANE_ID,
  type CameraDescriptor,
  type ClipLane,
  type ClipRef,
  type SceneWorld,
  type GeometryDescriptor,
  type LightDescriptor,
  withMaterialAt,
  wornMaterials,
  type MaterialDescriptor,
  type ModelDressRef,
  type ModelRef,
  type PathDescriptor,
  type SpriteDescriptor,
  type TextDescriptor,
  type Transform,
} from '@shared/domain/scene'
import { isRecord } from '@shared/guards'
import { changedFields, sameValues } from '@/helpers/objects'
import {
  withComponent,
  withoutComponent,
  type ComponentType,
  type JsonValue,
} from '@shared/domain/component'
import { newComponent, withComponentField } from '@shared/domain/componentRegistry'
import { applySelection, deselect, deselectAll, type SelectionMode } from '@/helpers/selection'
import { withField, type FieldValue } from './propertyFields'
import { newId } from '@/helpers/ids'
import { carvedNode, groupNode, meshNode } from './nodeFactory'
import {
  allNegative,
  canCarve,
  carveGraph,
  carvePlan,
  carveScene,
  isCarvable,
  placedIn,
} from '../csg/carve'
import { isCsgGraph, type CsgOperation } from '@shared/domain/csg'
import {
  canCastShadow,
  canReceiveShadow,
  canReparent,
  carriesMaterial,
  hasChildren,
  nodeById,
  rootsOf,
  rotationShows,
  subtreesOf,
  type AxisLock,
  type CarvedNode,
  type NodeMove,
  type SceneNode,
  type SceneNodeBase,
  type SceneNodeType,
  type SceneState,
  withAxisLock,
  withoutLockedAxes,
} from './sceneState'
import type { OptimizationSettings } from '@shared/domain/scene'

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
    // Through `refuses` like its plural twin, never by handing the state back: a refusal pushed
    // as a step is a ⌘Z that does nothing, and a redo stack emptied for an edit that never ran.
    refuses: state => tearsPlayerApart(state.nodes, [id]),
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
 * One shape for every edit of a shared field. What to write may be a function of the node and the
 * scene around it, which only the sweep holds: a command is replayed on redo, so a rule about the
 * scene has to be read at each `apply` rather than frozen into the closure.
 */
function editNode(
  label: string,
  id: string,
  changes: NodePatch | ((node: SceneNode, state: SceneState) => NodePatch),
): NodeEdit {
  const wanted = (node: SceneNode, state: SceneState): NodePatch =>
    typeof changes === 'function' ? changes(node, state) : changes

  return sweep(`${label}:${id}`, [
    {
      id,
      edit: (node, state) => ({ ...node, ...wanted(node, state) }),
      /**
       * 🛑 An edit that writes what the node already carries costs a ⌘Z that moves nothing — the
       * defect `refuses` exists for. Measured on the bench pass of 2026-08-25: a client sent one
       * transform three times, then had to undo three times to take one change back.
       */
      refuses: (node, state) =>
        Object.entries(wanted(node, state)).every(([key, value]) =>
          sameValues(value, node[key as keyof SceneNode]),
        ),
    },
  ])
}

/**
 * Where a node stands, how it is turned and how big it is.
 *
 * An angle `rotationShows` refuses is dropped, and the rest of the move written: the value would
 * sit in the document and cost an undo without the screen ever moving. Dropped rather than the
 * whole edit refused — a pivot drag over a mixed selection carries the sprite through space, and
 * *that* shows.
 */
export function setTransform(id: string, next: Transform): NodeEdit {
  return editNode('transform', id, (node, state) => {
    // Held axes first, so a padlock answers the viewport handle as it answers the field: both
    // write through here, and only here can refuse for both.
    const allowed = withoutLockedAxes(state, id, node.transform, next)

    return {
      transform: rotationShows(node, () => hasChildren(state.nodes, id))
        ? allowed
        : { ...allowed, rotation: node.transform.rotation },
    }
  })
}

/**
 * Holds one axis still, or lets it go. Written through `replace` rather than as a command by
 * whoever calls it: a padlock is a way of editing, not an edit, and ⌘Z should not take it back.
 */
export function withAxisHeld(state: SceneState, lock: AxisLock, held: boolean): SceneState {
  return { ...state, lockedAxes: withAxisLock(state.lockedAxes ?? [], lock, held) }
}

export function setNodeVisible(id: string, visible: boolean): NodeEdit {
  return editNode('visible', id, { visible })
}

function setNodeOptimization(id: string, optimization: OptimizationSettings | undefined): NodeEdit {
  return editNode('optimization', id, { optimization })
}

export function setNodesOptimization(
  nodes: readonly SceneNode[],
  optimization: OptimizationSettings | undefined,
): Command<SceneState> {
  return batch('optimization', nodes, node => setNodeOptimization(node.id, optimization))
}

/**
 * Hangs a node on one of its parent's attachment points, or takes it off — `null` lets it hang
 * from the character itself again.
 */
export function attachNode(id: string, socket: string | null): NodeEdit {
  return editNode('attach', id, socket === null ? { attach: undefined } : { attach: { socket } })
}

export function renameNode(id: string, name: string): NodeEdit {
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

export function setGeometry(id: string, geometry: GeometryDescriptor): NodeEdit {
  return editPart('geometry', id, 'mesh', { geometry })
}

export function setMeshMaterial(id: string, material: MaterialDescriptor): NodeEdit {
  return editPart('material', id, 'mesh', { material })
}

/**
 * The material of whatever wears one — a mesh, a text or a solid.
 *
 * Keyed on the FIELD rather than on the type, unlike `editPart`: three node kinds hold the same
 * descriptor, and a command per kind is how the solid came to be paintable nowhere.
 */
export function setNodeMaterial(id: string, material: MaterialDescriptor): NodeEdit {
  return sweep(`material:${id}`, [
    { id, edit: node => (carriesMaterial(node) ? { ...node, material } : null) },
  ])
}

/**
 * Gives an object something to DO while the game runs. Refused when it already carries one of
 * that type — a second `Health` would leave the winner to whichever system read first, and an
 * attach that overwrote the first would throw away what the author typed into it.
 */
export function attachComponent(id: string, type: ComponentType): NodeEdit {
  return editNode('component.add', id, node =>
    (node.components ?? []).some(component => component.type === type)
      ? {}
      : { components: [...(node.components ?? []), newComponent(type)] },
  )
}

/** Refused on an object that has not got one: an empty patch costs no entry in the history. */
export function detachComponent(id: string, type: ComponentType): NodeEdit {
  return editNode('component.remove', id, node =>
    (node.components ?? []).some(component => component.type === type)
      ? { components: withoutComponent(node.components ?? [], type) }
      : {},
  )
}

/**
 * One field of one component. Labelled by the field, so a drag on the speed coalesces into one
 * history entry while a change of axis right after stays a step of its own.
 */
export function setComponentField(
  id: string,
  type: ComponentType,
  key: string,
  value: JsonValue,
): NodeEdit {
  return editNode(`component.${type}.${key}`, id, node => {
    const held = (node.components ?? []).find(component => component.type === type)
    if (!held) return {}

    return {
      components: withComponent(node.components ?? [], withComponentField(held, key, value)),
    }
  })
}

export function setLight(id: string, light: LightDescriptor): NodeEdit {
  return editPart('light', id, 'light', { light })
}

/**
 * Only the fields every node shares: patching a discriminated field would let a light take a
 * geometry, which is exactly what the union exists to forbid.
 */
type NodePatch = Partial<
  Pick<
    SceneNode,
    | 'name'
    | 'visible'
    | 'transform'
    | 'castShadow'
    | 'receiveShadow'
    | 'components'
    | 'attach'
    | 'optimization'
  >
>

/** What one edit writes on one node, and `null` when the node is not its business. */
type NodeWrite = {
  id: string
  edit: (node: SceneNode, state: SceneState) => SceneNode | null
  /** `Command.refuses`. A node the scene no longer holds is never asked, and counts as refusing. */
  refuses?: (node: SceneNode, state: SceneState) => boolean
}

/**
 * An edit that also says what it writes node by node, so several of them fold into ONE pass. A
 * `Command` all the same: nothing holding one has to know it composes. **Built by `sweep` alone**
 * — `batch` keeps the writes and drops the command around them, so one made by hand would be
 * half-applied, and no type says otherwise.
 */
export type NodeEdit = Command<SceneState> & { writes: readonly NodeWrite[] }

/**
 * The discriminated half of one node, replaced. Keyed by `type`: `type` is what forbids a light
 * from holding a geometry, and a node of another kind is left alone rather than given a field its
 * shape has no room for.
 */
function editPart<T extends SceneNodeType>(
  label: string,
  id: string,
  type: T,
  changes: Partial<Omit<Extract<SceneNode, { type: T }>, keyof SceneNodeBase | 'type'>>,
): NodeEdit {
  return sweep(`${label}:${id}`, [
    { id, edit: node => (node.type === type ? { ...node, ...changes } : null) },
  ])
}

/**
 * ONE pass over the scene however many nodes an edit touches. Through `multi`, `refuses`, `apply`
 * and `revert` each cost a `find` and a `map` of the WHOLE scene per node, and a drag pays them
 * on every image it emits: moving 200 nodes of 40 000 took 76.30 ms an image, against 0.77 here.
 *
 * Two things `composed` did differently, and nothing guards either. The node is captured WHOLE
 * rather than the fields written — safe only because the history is a linear stack. And every
 * write reads the scene as it stood BEFORE the pass, where `composed` fed each part the state the
 * one before it returned: an edit reading a sibling it also writes would read a stale value here.
 */
function sweep(id: string, writes: readonly NodeWrite[]): NodeEdit {
  const byId = new Map(writes.map(write => [write.id, write]))
  // `composed` refused only when EVERY part did, so one part with no opinion settles it without
  // the scene being walked at all.
  const askable = writes.every(write => write.refuses)
  let previous: ReadonlyMap<string, SceneNode> = new Map()

  return {
    id,
    writes,
    // Asked AS the scene is walked, and the walk ends twice over: at the first node still worth
    // editing, and at the last one asked. Without the second, re-sending the value a single node
    // already carries — an eye clicked back, a drag on a held axis — reads 40 000 rows to say no.
    refuses: state => {
      if (writes.length === 0) return true
      if (!askable) return false

      let asked = 0
      for (const node of state.nodes) {
        const write = byId.get(node.id)
        if (!write) continue
        if (write.refuses?.(node, state) === false) return false

        asked += 1
        if (asked === byId.size) break
      }
      return true
    },
    // The scene is copied only once something is written: an edit meeting nothing it can act on
    // hands back the state itself rather than a fresh array of forty thousand.
    apply: state => {
      const taken = new Map<string, SceneNode>()
      let nodes: SceneNode[] | null = null

      for (let at = 0; at < state.nodes.length; at += 1) {
        const node = state.nodes[at]
        if (!node) continue
        const written = byId.get(node.id)?.edit(node, state)
        if (!written) continue

        nodes ??= [...state.nodes]
        nodes[at] = written
        taken.set(node.id, node)
      }

      previous = taken
      return nodes ? { ...state, nodes } : state
    },
    revert: state =>
      previous.size === 0
        ? state
        : { ...state, nodes: state.nodes.map(node => previous.get(node.id) ?? node) },
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
 *
 * A `NodeEdit` and not a `Command`, so the whole selection is held to ONE sweep by the compiler:
 * an edit that writes somewhere other than a node — a lens keyed onto a track — has to compose
 * itself under `multi`, and say so where it is written.
 */
export function batch<T extends { id: string }>(
  label: string,
  targets: readonly T[],
  make: (target: T) => NodeEdit | null,
): Command<SceneState> {
  return sweep(
    commandId(
      label,
      targets.map(target => target.id),
    ),
    targets.flatMap(target => make(target)?.writes ?? []),
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
    // A text and a solid are lit exactly as a mesh is, and wear the same descriptor — so one
    // section of the inspector serves the three, and none has to know the others exist.
    if (!carriesMaterial(node)) return null
    return setNodeMaterial(node.id, { ...node.material, ...changes })
  })
}

/**
 * A rail rewritten. The three gestures a rail offers — move a point, add one, drop one — all
 * land here, because each of them is the same node holding another list of points.
 */
export function setPath(id: string, path: PathDescriptor): NodeEdit {
  return editPart('path', id, 'path', { path })
}

/** What a camera sees through: its lens, edited like any other descriptor. */
export function setCamera(id: string, camera: CameraDescriptor): NodeEdit {
  return editPart('camera', id, 'camera', { camera })
}

/**
 * A lens parameter typed into the inspector, written onto every selected camera.
 *
 * No anchor to spread from, unlike a light's: a lens has no vector field, so the value typed is
 * the value every camera of the selection takes.
 */
export function setCameraOn(
  nodes: readonly SceneNode[],
  name: string,
  value: FieldValue,
): Command<SceneState> {
  return batch('camera', nodes, node =>
    node.type === 'camera' ? setCamera(node.id, withField(node.camera, name, value)) : null,
  )
}

/**
 * The sprite's own parameters. A node of another type is left alone rather than patched, exactly
 * as `editMesh` refuses to give a light a geometry.
 */
export function setSprite(id: string, sprite: SpriteDescriptor): NodeEdit {
  return editPart('sprite', id, 'sprite', { sprite })
}

/**
 * What an imported model plays: its lanes, and the blocks inside each. No lane at all puts it
 * back to its rest pose.
 *
 * The whole set is written rather than one lane patched, for the reason `setModelTextures` states:
 * what the band holds IS the set, and a partial write would leave the revert unable to say which
 * lanes it was answering for.
 */
export function setModelLanes(id: string, lanes: readonly ClipLane[]): Command<SceneState> {
  return editModel(id, 'clips', model => {
    const rest = { ...model }
    delete rest.lanes
    // A single empty lane is exactly what the band shows a model that has never played anything,
    // so writing one says nothing the default does not — and a rest pose stays a document that
    // holds no animation at all.
    return lanes.length > 1 || lanes.some(lane => lane.clips.length > 0) ? { ...rest, lanes } : rest
  })
}

/**
 * One block more on a model's band, at the end of its first lane.
 *
 * The lane is made if the model has none: a character that has never played anything holds no
 * lane at all, and it is exactly the one an animation is dropped on.
 */
export function addModelClip(id: string, clip: ClipRef): Command<SceneState> {
  return editModel(id, 'lanes', model => {
    const lanes = model.lanes?.length ? model.lanes : [clipLane(MAIN_LANE_ID, [])]
    const [first, ...rest] = lanes
    if (!first) return model

    return { ...model, lanes: [{ ...first, clips: [...first.clips, clip] }, ...rest] }
  })
}

/** One block gone, wherever it sat. The lane stays, empty if it has to — see `setModelLanes`. */
export function removeModelClip(id: string, clipId: string): Command<SceneState> {
  return editModel(id, 'lanes', model => ({
    ...model,
    lanes: model.lanes?.map(lane => ({
      ...lane,
      clips: lane.clips.filter(clip => clip.id !== clipId),
    })),
  }))
}

/** What covers a model — a picture, the materials it wears, or `null` for its file's own. */
export function dressModel(id: string, dress: ModelDressRef | null): Command<SceneState> {
  return editModel(id, 'dress', model => dressed(model, dress))
}

/**
 * One slot of a model's material list, the rest carried over. Emptying a slot LEAVES it — taking
 * the row away under the finger that just cleared it is not what clearing means.
 */
export function wearMaterialAt(id: string, slot: number, documentId: string): Command<SceneState> {
  return editModel(id, 'dress', model =>
    dressed(model, {
      kind: 'materials',
      documentIds: withMaterialAt(wornMaterials(model.dress), slot, documentId),
    }),
  )
}

/** The dress written onto a model — and `materialDocumentId` dropped, which is read once and
 * never written again: left in place it would go on contradicting `dress`. */
function dressed(model: ModelRef, dress: ModelDressRef | null): ModelRef {
  const rest = { ...model }
  delete rest.dress
  delete rest.materialDocumentId
  return dress ? { ...rest, dress } : rest
}

/**
 * One field of a model's reference, with the rest of it carried over. Written once because the
 * carrying is the whole point: an edit that rebuilt the reference from `assetId` alone dropped
 * every other field a model holds — which is how a texture override vanished on the next play.
 */
function editModel(id: string, edited: string, next: (model: ModelRef) => ModelRef): NodeEdit {
  return sweep(`${edited}:${id}`, [
    { id, edit: node => (node.type === 'model' ? { ...node, model: next(node.model) } : null) },
  ])
}

/**
 * The words, the face and the three numbers that shape them. A node of another type is left
 * alone rather than patched, exactly as `editMesh` refuses to give a light a geometry.
 */
export function setText(id: string, text: TextDescriptor): NodeEdit {
  return editPart('text', id, 'text', { text })
}

/** The material a text wears — the same descriptor a mesh does, on the other node type. */
export function setTextMaterial(id: string, material: MaterialDescriptor): NodeEdit {
  return editPart('material', id, 'text', { material })
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
 * Whether a drag may land: no loop closed, and no player module left without its body or its eye.
 * The one predicate every door reads — `canReparent` alone let a module be taken apart.
 */
export function canMoveNode(
  nodes: readonly SceneNode[],
  id: string,
  parentId: string | null,
): boolean {
  return canReparent(nodes, id, parentId) && !leavesPlayerModule(nodes, id, parentId)
}

/**
 * Hangs a node from another, or from the scene when the parent is `null`.
 *
 * The old parent is captured **as the command runs**, like every other edit here: what a node
 * hung from before is only known once the move actually happens, and a redo has to re-capture.
 *
 * A move that would close the tree on itself, or take a required part out of a player module, is
 * refused rather than applied — see `canMoveNode`.
 */
export function reparentNode(id: string, parentId: string | null): Command<SceneState> {
  let previous: string | null = null
  let moved = false

  return {
    id: `reparent:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (!node || node.parentId === parentId || !canMoveNode(state.nodes, id, parentId)) {
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
 * Moves a BATCH within the order of a level, and to another level in the same gesture — several
 * rows dragged between two others. They land contiguous, in the order given.
 *
 * 🛑 `index` counts the level once the WHOLE batch has left it, which is what `Tree` reports — so
 * they are lifted together and put back together, NEVER one after the other: a member still in
 * place is counted as a sibling by the next one, and the batch scatters. Measured on a level of
 * five where two members moved to its end: they landed two apart.
 */
export function reorderNodes(
  ids: readonly string[],
  parentId: string | null,
  index: number,
): Command<SceneState> {
  let previous: { id: string; parentId: string | null; at: number }[] | null = null

  return {
    id: commandId('reorder', ids),
    apply: state => {
      const moving = ids
        .map(id => nodeById(state, id))
        .filter(node => node !== null)
        .filter(node => canMoveNode(state.nodes, node.id, parentId))
      if (moving.length === 0) return state

      const placeOf = new Map(state.nodes.map((node, at) => [node.id, at]))
      previous = moving.map(node => ({
        id: node.id,
        parentId: node.parentId,
        at: placeOf.get(node.id) ?? -1,
      }))

      // Each subtree WHOLE, and each node once: a member nested inside another member is already
      // carried by it, and taking it twice would put it in the array twice.
      const taken = new Set<string>()
      const carried: SceneNode[] = []
      for (const node of moving) {
        const own = new Set(subtreesOf(state.nodes, [node.id]).map(one => one.id))
        for (const one of state.nodes) {
          if (!own.has(one.id) || taken.has(one.id)) continue
          taken.add(one.id)
          carried.push(one.id === node.id ? { ...one, parentId } : one)
        }
      }

      const rest = state.nodes.filter(one => !taken.has(one.id))
      const before = rest.filter(one => one.parentId === parentId)[index]
      // Past the last sibling is the end of the level, and the array's end is a place no sibling
      // comes after — the batch having left, nothing of it is stranded there.
      const target = before === undefined ? rest.length : rest.indexOf(before)

      return { ...state, nodes: [...rest.slice(0, target), ...carried, ...rest.slice(target)] }
    },
    // Each back where it was taken from, lowest index first: putting them back in that order
    // rebuilds the array the batch left. A subtree that was SCATTERED comes back gathered — the
    // same tree, since a level is read by `parentId`.
    revert: state =>
      previous === null
        ? state
        : [...previous]
            .sort((one, other) => one.at - other.at)
            .reduce((current, back) => lifted(current, back.id, back.parentId, back.at), state),
  }
}

/**
 * 🛑 The subtree travels WHOLE: dragging a group past its own children would otherwise leave it
 * BEHIND them in the array, and a parent that trails its children is the one property the rest of
 * the engine reads this array for.
 */
function lifted(state: SceneState, id: string, parentId: string | null, at: number): SceneState {
  const moving = new Set(subtreesOf(state.nodes, [id]).map(one => one.id))
  const rest = state.nodes.filter(one => !moving.has(one.id))
  const carried = state.nodes
    .filter(one => moving.has(one.id))
    .map(one => (one.id === id ? { ...one, parentId } : one))

  return { ...state, nodes: [...rest.slice(0, at), ...carried, ...rest.slice(at)] }
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
export function groupNodes(nodes: readonly SceneNode[], id = newId()): Command<SceneState> {
  const roots = rootsOf(nodes)
  const shared = roots.every(node => node.parentId === roots[0]?.parentId)
  const group = { ...groupNode(), id, parentId: shared ? (roots[0]?.parentId ?? null) : null }

  return multi(commandId('group', [group.id]), [
    addNode(group),
    ...roots.map(node => reparentNode(node.id, group.id)),
  ])
}

/**
 * Folds a selection into one solid, and takes the nodes it was cut from out of the scene.
 *
 * The matter is `carvePlan`'s to elect and the ORDER OF THE CLICKS says nothing: the solid stands
 * where the matter stood, wears its material and hangs from its parent, so the cut reads as the
 * wall gaining a window rather than a new object appearing. `matterId` forces the election for
 * the rare case a hand means the other way round; `null` when fewer than two nodes carry a shape.
 */
export function carveNodes(
  picked: readonly SceneNode[],
  operation: CsgOperation,
  all: readonly SceneNode[],
  matterId?: string,
): Command<SceneState> | null {
  if (!canCarve(picked)) return null
  // ONE sweep of the scene for the whole fold: the election and the recipe both walk it, and
  // each used to build its own index.
  const scene = carveScene(picked, all)
  const plan = carvePlan(scene, operation, matterId)
  // A `matterId` naming nothing in the selection: refused rather than quietly elected otherwise.
  if (!plan) return null

  const { matter, tools } = plan
  const solid = carvedNode(carveGraph(matter, tools, scene.byId), {
    // Without the matter's SCALE, which travelled into the base brush — see `carveGraph`, where
    // keeping it here is what sheared a turned tool.
    transform: { ...matter.transform, scale: { x: 1, y: 1, z: 1 } },
    material: matter.material,
    parentId: matter.parentId,
    name: matter.name,
  })

  return multi(commandId('carve', [solid.id]), [
    addNode(solid),
    // Their subtrees with them: a child left hanging from a node the scene no longer holds is
    // dropped by `flattenTree` — invisible in the outliner, still written to the file.
    removeNodes(all, [matter.id, ...tools.map(tool => tool.node.id)]),
  ])
}

/**
 * Marks shapes as tools for the next boolean, or takes the mark off — Roblox's Negate.
 *
 * Nodes carrying no shape are skipped rather than given a flag nothing would read, exactly as
 * `setShadowOn` skips a light.
 */
export function setNodesNegative(
  picked: readonly SceneNode[],
  negative: boolean,
): Command<SceneState> {
  // Not `batch`: the flag lives on the carvable half of a node, which no shared patch reaches.
  const marked = [...new Set(picked.filter(isCarvable).map(node => node.id))]

  return sweep(
    commandId('negate', marked),
    marked.map(id => ({
      id,
      edit: (node: SceneNode) => (isCarvable(node) ? { ...node, negative } : null),
    })),
  )
}

/**
 * The same, decided from what is already marked — one button doing both, since a toolbar button
 * has no room to say which of the two it means. A selection wholly marked comes back unmarked;
 * anything else is marked, so a half-marked selection finishes the job rather than undoing it.
 */
export function negateNodes(picked: readonly SceneNode[]): Command<SceneState> {
  return setNodesNegative(picked, !allNegative(picked))
}

/**
 * Undoes a fold: the solid goes, and the brushes it was cut from come back as meshes — each with
 * the shape, the placement AND the material it wore before. What comes back is what the GRAPH
 * kept, which is the whole point of ADR-25: a mesh alone could not be taken apart again.
 */
export function separateNode(node: CarvedNode): Command<SceneState> {
  return multi(commandId('separate', [node.id]), [
    ...brushesOf(node).map(brush => addNode(brush)),
    removeNode(node.id),
  ])
}

/**
 * The same fold, run the OTHER WAY — one gesture to repair a cut that came out inverted, with no
 * undo and nothing to understand. The brushes come back exactly as `separateNode` gives them and
 * are folded again with the first TOOL for matter; the roles swap through the marks, so
 * `carvePlan` stays the one place that reads them. `null` for a solid of a single brush.
 */
export function invertCarve(
  node: CarvedNode,
  all: readonly SceneNode[],
): Command<SceneState> | null {
  const brushes = brushesOf(node)
  const [was, next] = brushes
  if (!was || !next) return null

  const swapped = brushes.map(brush =>
    brush === was ? withNegative(brush, true) : brush === next ? withNegative(brush, false) : brush,
  )
  const scene = all.filter(one => one.id !== node.id).concat(swapped)
  const folded = carveNodes(swapped, node.carved.steps[0]?.operation ?? 'subtract', scene, next.id)
  if (!folded) return null

  return multi(commandId('invertCarve', [node.id]), [
    ...swapped.map(brush => addNode(brush)),
    removeNode(node.id),
    folded,
  ])
}

function withNegative(node: SceneNode, negative: boolean): SceneNode {
  return isCarvable(node) ? { ...node, negative } : node
}

/**
 * The shapes a solid was cut from, standing where the cut had them. A brush that was SUBTRACTED
 * comes back MARKED, so folding the same selection again gives the same solid whichever button is
 * pressed — DERIVED from the verb, not restored: a plain Percer with no marks hands its tool back
 * red, and an `intersect` fold hands back nothing marked at all.
 */
function brushesOf(node: CarvedNode): SceneNode[] {
  const parts = [
    { part: node.carved.base, negative: false },
    ...node.carved.steps.map(step => ({
      part: step.part,
      negative: step.operation === 'subtract',
    })),
  ]

  return parts.map(({ part, negative }) => {
    // In the solid's frame, so a brush lands back where the cut had it standing.
    const transform = placedIn(node.transform, part.transform)
    const born = { material: part.material, parentId: node.parentId, name: part.name, negative }

    // A brush that carried a RECIPE comes back a solid, not a mesh: separating once must not
    // flatten the cuts already made inside it.
    return isCsgGraph(part.geometry)
      ? carvedNode(part.geometry, { ...born, transform })
      : { ...meshNode(part.geometry, born), transform }
  })
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
  const carried = subtreesOf(
    nodes,
    picked.map(node => node.id),
  )
  const fresh = carried.map(node => ({ node, id: newId() }))
  const renamed = new Map(fresh.map(({ node, id }) => [node.id, id]))

  return fresh.map(({ node, id }) => {
    const copy = {
      ...node,
      id,
      parentId: node.parentId === null ? null : (renamed.get(node.parentId) ?? node.parentId),
    }
    return node.type === 'mesh' && node.instances
      ? {
          ...copy,
          instances: node.instances.map(instance => ({ ...instance, sourceId: newId() })),
        }
      : copy
  })
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
    // 🛑 Here and not at each door: a paste, a ⌘D, a prefab and a template all arrive through
    // this one, and three of them never knew to ask. Which module plays would go back to order.
    refuses: state => copies.length > 0 && bringsSecondPlayer(state.nodes, copies),
    // Nothing to put down clears no selection: an empty add is a no-op, not a deselect.
    apply: state =>
      copies.length === 0
        ? state
        : {
            ...state,
            nodes: [...state.nodes, ...copies],
            selectedIds: copies.map(copy => copy.id),
          },
    revert: state => {
      // A Set rather than a scan per node: a prefab of 200 put down in a scene of 1 000 made ⌘Z
      // walk 200 000 comparisons.
      const added = new Set(copies.map(copy => copy.id))
      return {
        ...state,
        nodes: state.nodes.filter(node => !added.has(node.id)),
        selectedIds: copies.reduce((ids, copy) => deselect(ids, copy.id), state.selectedIds),
      }
    },
  }
}

/** Deleting a selection is one gesture, so it is one entry in the history. */
export function removeNodes(
  nodes: readonly SceneNode[],
  ids: readonly string[],
): Command<SceneState> {
  // The whole subtree, not the picked rows: a child left behind would hang from a parent the
  // scene no longer holds, and `flattenTree` drops an orphan rather than promoting it.
  const doomed = new Set(subtreesOf(nodes, ids).map(node => node.id))
  let taken: { at: number; node: SceneNode }[] = []

  return {
    id: commandId('remove', ids),
    // What `multi` of one command per node gave for free: `[].every()` is true, so a delete that
    // reaches nothing refused. Without it ⌘Z gains a step that does nothing, and the redo stack
    // is cleared for an edit that never happened.
    // 🛑 A module standing without its body or its eye is a scene whose camera falls back on the
    // sweep — the arbitration the module exists to replace, reintroduced by a plain Delete.
    refuses: state => doomed.size === 0 || tearsPlayerApart(state.nodes, ids),
    // ONE sweep, not one `removeNode` per doomed node — each of those scans the scene twice.
    apply: state => {
      taken = []
      const kept: SceneNode[] = []
      for (let at = 0; at < state.nodes.length; at += 1) {
        const node = state.nodes[at]
        if (!node) continue
        if (doomed.has(node.id)) taken.push({ at, node })
        else kept.push(node)
      }
      if (taken.length === 0) return state

      // `deselectAll` rather than a filter: it hands back the SAME array when nothing was
      // selected, and everything watching the selection re-renders on a fresh one.
      return { ...state, nodes: kept, selectedIds: deselectAll(state.selectedIds, doomed) }
    },
    // Merged rather than spliced back one by one: a `splice` shifts everything after it, so
    // undoing 16 000 rows out of 40 000 cost 33.9 ms — past what an image is worth — against 0.21
    // flat here. `taken` is ascending, which is what lets the two lists merge.
    revert: state => {
      if (taken.length === 0) return state

      const nodes: SceneNode[] = []
      let kept = 0
      const keep = (): void => {
        const node = state.nodes[kept]
        if (node) nodes.push(node)
        kept += 1
      }
      for (const { at, node } of taken) {
        while (nodes.length < at && kept < state.nodes.length) keep()
        nodes.push(node)
      }
      while (kept < state.nodes.length) keep()
      return { ...state, nodes }
    },
  }
}

/** Where a drag left every node it carried. One drag, one entry, however many nodes moved. */
export function moveNodes(moves: readonly NodeMove[]): Command<SceneState> {
  return batch('transform', moves, move => setTransform(move.id, move.transform))
}

/**
 * What lights the scene and what hangs behind it. In the history like any other edit of the
 * document: choosing a sky is a decision about the scene, and ⌘Z has to take it back like the rest.
 *
 * A patch rather than a whole world, so a preset writing five fields and a slider writing one are
 * the same call — and so a field this build does not know is left exactly as the file spelled it.
 */
export function setWorld(patch: Partial<SceneWorld>): Command<SceneState> {
  let previous: SceneWorld | null = null

  return {
    // Named by what moved, so a drag of one slider coalesces with itself and not with the next.
    // Ordered by code point rather than by language: these are field names, not words on screen.
    id: `world:${Object.keys(patch)
      .sort((left, right) => (left < right ? -1 : 1))
      .join(',')}`,
    apply: state => {
      previous = state.world
      return { ...state, world: { ...state.world, ...patch } }
    },
    revert: state => (previous ? { ...state, world: previous } : state),
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
