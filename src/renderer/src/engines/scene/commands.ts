import { composed, type Command } from '../core/history'
import {
  rigFaultOf,
  rigRenamed,
  rigWithBones,
  rigWithoutBone,
  rigWithRole,
  type IkChain,
  type Rig,
  type RigBone,
} from '@shared/domain/rig'
import type { HumanoidRole } from '@shared/domain/humanoid'
import { rigHandBones } from './rigFit'
import { ikLinksOf } from './ik'
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
  type MaterialDescriptor,
  type ModelRef,
  type PathDescriptor,
  type SpriteDescriptor,
  type TextDescriptor,
  type Transform,
} from '@shared/domain/scene'
import { isRecord } from '@shared/guards'
import { changedFields, sameValues } from '@/helpers/objects'
import { applySelection, deselect, type SelectionMode } from '@/helpers/selection'
import { withField, type FieldValue } from './propertyFields'
import { newId } from '@/helpers/ids'
import { carvedNode, groupNode, meshNode } from './nodeFactory'
import { canCarve, carveGraph, carvePlan, isCarvable, isNegative, placedIn } from '../csg/carve'
import { isCsgGraph, type CsgOperation } from '@shared/domain/csg'
import {
  canCastShadow,
  canReceiveShadow,
  canReparent,
  carriesMaterial,
  hasChildren,
  nodeById,
  rotationShows,
  subtreeOf,
  withAxisLock,
  withoutLockedAxes,
  type AxisLock,
  type CarvedNode,
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
    /**
     * 🛑 An edit that writes what the node already carries costs a ⌘Z that moves nothing — the
     * defect `refuses` exists for. Measured on the bench pass of 2026-08-25: a client sent one
     * transform three times, then had to undo three times to take one change back.
     */
    refuses: state => {
      const node = nodeById(state, id)
      if (!node) return true

      const wanted = typeof changes === 'function' ? changes(node, state) : changes
      return Object.entries(wanted).every(([key, value]) =>
        sameValues(value, node[key as keyof SceneNode]),
      )
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

/**
 * One field of a node, on every KIND that carries it — keyed on the field rather than on the
 * type, unlike `patchPart`. Three node kinds hold a material and two hold the tool mark; a
 * command per kind is how the solid came to be paintable nowhere.
 */
function editField<T extends SceneNode, K extends keyof T & string>(
  id: string,
  holds: (node: SceneNode) => node is T,
  field: K,
  written: T[K],
): Command<SceneState> {
  // Wrapped rather than compared to a sentinel: `false` and `null` are both legal values here.
  let previous: { held: T[K] } | null = null

  const write = (state: SceneState, value: T[K]): SceneState => ({
    ...state,
    nodes: state.nodes.map(node =>
      node.id === id && holds(node) ? { ...node, [field]: value } : node,
    ),
  })

  return {
    id: `${field}:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (!node || !holds(node)) return state
      previous = { held: node[field] }
      return write(state, written)
    },
    revert: state => (previous ? write(state, previous.held) : state),
  }
}

/** The material of whatever wears one — a mesh, a text or a solid. */
export function setNodeMaterial(id: string, material: MaterialDescriptor): Command<SceneState> {
  return editField(id, carriesMaterial, 'material', material)
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
export function setPath(id: string, path: PathDescriptor): Command<SceneState> {
  let previous: PathDescriptor | null = null

  return {
    id: `path:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'path') return state
      previous = node.path
      return patchPart(state, id, 'path', { path })
    },
    revert: state => (previous ? patchPart(state, id, 'path', { path: previous }) : state),
  }
}

/** What a camera sees through: its lens, edited like any other descriptor. */
export function setCamera(id: string, camera: CameraDescriptor): Command<SceneState> {
  let previous: CameraDescriptor | null = null

  return {
    id: `camera:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (node?.type !== 'camera') return state
      previous = node.camera
      return patchPart(state, id, 'camera', { camera })
    },
    revert: state => (previous ? patchPart(state, id, 'camera', { camera: previous }) : state),
  }
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

/** The skeleton put on a model, or none. Undo comes for free, which is why a rig is a document's. */
export function setModelRig(id: string, rig: Rig | null): Command<SceneState> {
  return editModel(id, 'rig', model => {
    const rest = { ...model }
    delete rest.rig
    return rig ? { ...rest, rig } : rest
  })
}

/**
 * One edit of a model's skeleton, refused whole when the result would not hold.
 *
 * A change answering `null` writes nothing at all rather than a rig the document reader would
 * drop on the next open — a cycle, a name taken twice, one role on two bones. The weights follow
 * on their own: the engine re-binds whenever `model.rig` changes, so nothing recomputes here.
 */
function editRigBones(
  id: string,
  edited: string,
  change: (bones: readonly RigBone[]) => readonly RigBone[] | null,
): Command<SceneState> {
  return editModel(id, edited, model => {
    if (!model.rig) return model

    const bones = change(model.rig.bones)
    if (!bones || rigFaultOf(bones) !== null) return model

    return { ...model, rig: { ...model.rig, bones } }
  })
}

/** A bone hung under one the rig already holds. Refused if the parent, the name or the role clash. */
export function addRigBone(id: string, bone: RigBone): Command<SceneState> {
  return editRigBones(id, 'rigBone', bones => rigWithBones(bones, [bone]))
}

/** A bone taken out, its children hung where it hung — an elbow leaves, the hand stays. */
export function removeRigBone(id: string, name: string): Command<SceneState> {
  return editRigBones(id, 'rigBone', bones => rigWithoutBone(bones, name))
}

export function renameRigBone(id: string, from: string, to: string): Command<SceneState> {
  return editRigBones(id, 'rigBone', bones => rigRenamed(bones, from, to))
}

/** Which joint of the standard a bone IS. `null` says it fills none. */
export function setRigBoneRole(
  id: string,
  name: string,
  role: HumanoidRole | null,
): Command<SceneState> {
  return editRigBones(id, 'rigRole', bones => rigWithRole(bones, name, role))
}

/** The thirty finger bones, at rest, on whatever hands the rig holds. */
export function addRigHands(id: string): Command<SceneState> {
  return editRigBones(id, 'rigBone', bones => {
    const hands = rigHandBones(bones)
    return hands && rigWithBones(bones, hands)
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

/** What a handle bone is called, after the joint that reaches for it. */
const IK_HANDLE = '.handle'

/**
 * A handle a joint reaches for: one bone added ON the joint, and the chain that follows it.
 *
 * Both in one command, so undoing gives back a rig with neither — a handle left behind by an
 * undone chain would be a bone nothing drives and nothing explains.
 */
export function addIkChain(id: string, effector: string): Command<SceneState> {
  return editModel(id, 'rigIk', model => {
    const rig = model.rig
    const joint = rig?.bones.find(bone => bone.name === effector)
    if (!rig || !joint) return model

    const handle: RigBone = {
      name: `${effector}${IK_HANDLE}`,
      parent: joint.parent,
      rest: joint.rest,
    }
    const bones = rigWithBones(rig.bones, [handle])
    if (!bones) return model

    const chain: IkChain = {
      id: newId(),
      effector,
      target: handle.name,
      links: ikLinksOf(rig.bones, effector),
    }
    if (chain.links.length === 0) return model

    return { ...model, rig: { ...rig, bones, ik: [...(rig.ik ?? []), chain] } }
  })
}

/** The chain and the handle it reached for, both. */
export function removeIkChain(id: string, chainId: string): Command<SceneState> {
  return editModel(id, 'rigIk', model => {
    const rig = model.rig
    const dropped = rig?.ik?.find(chain => chain.id === chainId)
    if (!rig || !dropped) return model

    return {
      ...model,
      rig: {
        ...rig,
        bones: rigWithoutBone(rig.bones, dropped.target),
        ik: rig.ik?.filter(chain => chain.id !== chainId),
      },
    }
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

/** The finish a model wears over its file. An empty one is « what the glTF said ». */
export function setModelMaterial(id: string, material: ModelRef['material']): Command<SceneState> {
  return editModel(id, 'material', model => {
    const rest = { ...model }
    delete rest.material
    return material && Object.keys(material).length > 0 ? { ...rest, material } : rest
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
  const plan = carvePlan(picked, operation, all, matterId)
  // A `matterId` naming nothing in the selection: refused rather than quietly elected otherwise.
  if (!plan) return null

  const { matter, tools } = plan
  const solid = carvedNode(carveGraph(matter, tools, all), {
    // Without the matter's SCALE, which travelled into the base brush — see `carveGraph`, where
    // keeping it here is what sheared a turned tool.
    transform: { ...matter.transform, scale: { x: 1, y: 1, z: 1 } },
    material: matter.material,
    parentId: matter.parentId,
    name: matter.name,
  })

  return multi(commandId('carve', [solid.id]), [
    addNode(solid),
    // Their subtrees with them, exactly as `removeNodes` does: a child left hanging from a node
    // the scene no longer holds is dropped by `flattenTree` — invisible in the outliner, still
    // written to the file.
    ...subtreeOf(all, matter.id)
      .concat(tools.flatMap(tool => subtreeOf(all, tool.node.id)))
      .map(node => removeNode(node.id)),
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
  return batch('negate', picked.filter(isCarvable), node =>
    editField(node.id, isCarvable, 'negative', negative),
  )
}

/**
 * The same, decided from what is already marked — one button doing both, since a toolbar button
 * has no room to say which of the two it means. A selection wholly marked comes back unmarked;
 * anything else is marked, so a half-marked selection finishes the job rather than undoing it.
 */
export function negateNodes(picked: readonly SceneNode[]): Command<SceneState> {
  return setNodesNegative(
    picked,
    picked.filter(isCarvable).some(node => !isNegative(node)),
  )
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
