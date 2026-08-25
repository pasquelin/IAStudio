import { mdiCubeOutline } from '@mdi/js'
import type {
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  Transform,
  Vector3,
} from '@shared/domain/scene'
import { DEFAULT_CAMERA, DEFAULT_PATH } from '@shared/domain/scene'
import { newId } from '@/helpers/ids'
import { defaultMeshMaterial } from './checkerTextures'
import { lightByKind } from './lightTypes'
import { primitiveByKind } from './meshPrimitives'
import {
  CAMERA_ICON,
  CARVED_ICON,
  GROUP_ICON,
  MODEL_ICON,
  PATH_ICON,
  SPRITE_ICON,
  TEXT_ICON,
} from './nodeKinds'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  DEFAULT_TEXT,
  IDENTITY_TRANSFORM,
  shadowDefaults,
  type SceneNode,
} from './sceneState'

/**
 * A node is named after its class, as in the three.js editor — `Box`, `SpotLight` — and never
 * after the translated menu row that made it: a name is document data, and a scene whose
 * contents are called `Cube` in French and `Box` in English cannot be shared between the two.
 */
function classNameOf(kind: string): string {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}

/** Where a node stands, at the scale it is built at — what every template and level places by. */
export function transformAt(position: Vector3, rotation: Vector3 = ORIGIN): Transform {
  return { ...IDENTITY_TRANSFORM, position, rotation }
}

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }

/**
 * A solid, named after its class like every other node. The one place a mesh is built: the Add
 * menu and the scene templates both come through here, so neither can hand out a mesh wearing a
 * material the other does not — which is what the working texture depends on.
 */
export function meshNode(
  geometry: GeometryDescriptor,
  {
    transform = IDENTITY_TRANSFORM,
    material = defaultMeshMaterial(),
    castShadow,
    parentId = null,
    name = classNameOf(geometry.kind),
  }: MeshOptions = {},
): SceneNode {
  return {
    id: newId(),
    parentId,
    name,
    visible: true,
    transform,
    ...shadowDefaults({ type: 'mesh' }),
    ...(castShadow === undefined ? {} : { castShadow }),
    type: 'mesh',
    geometry,
    material,
  }
}

/** What a caller may settle about a mesh. Everything left out is what the Add menu would give. */
export type MeshOptions = {
  transform?: Transform
  material?: MaterialDescriptor
  /** A floor throws no shadow, and taking it out of the depth pass is the point of saying so. */
  castShadow?: boolean
  /** Hangs it under a group — what a level built of thirty parts needs to stay readable. */
  parentId?: string | null
  /**
   * English like every other node name, and for the same reason as a group's. Left out, a mesh
   * is named after its class: fine for one added by hand, useless for a set of thirty where
   * eleven rows would read `Box`.
   */
  name?: string
}

export function lightNode(light: LightDescriptor, position: Vector3): SceneNode {
  return {
    id: newId(),
    parentId: null,
    name: `${classNameOf(light.kind)}Light`,
    visible: true,
    transform: { ...IDENTITY_TRANSFORM, position },
    ...shadowDefaults({ type: 'light', light }),
    type: 'light',
    light,
  }
}

/**
 * An imported model, as one node holding a reference. Named after the asset rather than after
 * its class: two cubes are both `Box`, but two imported models are two different files, and the
 * outliner is where you tell them apart.
 */
export function modelNode(assetId: string, name: string): SceneNode {
  return {
    id: newId(),
    parentId: null,
    name,
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'model' }),
    type: 'model',
    model: { assetId },
  }
}

/**
 * A camera of the scene: what a render looks through, placed like anything else. Back and up a
 * little by default — a camera born inside the object at the centre would show nothing at all.
 */
export function cameraNode(
  transform: Transform = { ...IDENTITY_TRANSFORM, position: { x: 0, y: 2, z: 6 } },
): SceneNode {
  return {
    id: newId(),
    parentId: null,
    name: 'Camera',
    visible: true,
    transform,
    ...shadowDefaults({ type: 'camera' }),
    type: 'camera',
    camera: DEFAULT_CAMERA,
  }
}

/** A rail. Born with two points, since a curve through one is a point with a name. */
export function pathNode(): SceneNode {
  return {
    id: newId(),
    parentId: null,
    name: 'Path',
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'path' }),
    type: 'path',
    path: DEFAULT_PATH,
  }
}

/**
 * A picture that always faces the camera. Built mapless: the picture is picked in the inspector
 * from the project's assets, and a sprite that demanded one before it could exist would be a
 * node the Add menu could not add.
 */
export function spriteNode(): SceneNode {
  return {
    id: newId(),
    parentId: null,
    name: 'Sprite',
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'sprite' }),
    type: 'sprite',
    sprite: DEFAULT_SPRITE,
  }
}

/**
 * Words as a solid. Born with something written in it rather than empty: a text node that draws
 * nothing until someone finds the field is a node the Add menu appears to have failed at.
 */
export function textNode(): SceneNode {
  return {
    id: newId(),
    parentId: null,
    name: 'Text',
    visible: true,
    transform: IDENTITY_TRANSFORM,
    ...shadowDefaults({ type: 'text' }),
    type: 'text',
    text: DEFAULT_TEXT,
    material: DEFAULT_MATERIAL,
  }
}

/** An empty node others hang from. Its transform moves everything under it, and nothing else. */
export function groupNode(transform = IDENTITY_TRANSFORM, name = 'Group'): SceneNode {
  return {
    id: newId(),
    parentId: null,
    // Named after its class by default, like every other node: a scene whose contents are called
    // `Groupe` in French and `Group` in English cannot be shared between the two. A caller that
    // builds a set names its parts in English for the same reason — three rows reading `Group`
    // are three rows one has to open to tell apart.
    name,
    visible: true,
    transform,
    ...shadowDefaults({ type: 'group' }),
    type: 'group',
  }
}

/** The glyph belongs to the registry entry, not to whichever panel happens to draw the node. */
export function iconOf(node: SceneNode): string {
  if (node.type === 'model') return MODEL_ICON
  if (node.type === 'group') return GROUP_ICON
  if (node.type === 'sprite') return SPRITE_ICON
  if (node.type === 'text') return TEXT_ICON
  if (node.type === 'camera') return CAMERA_ICON
  if (node.type === 'path') return PATH_ICON
  if (node.type === 'carved') return CARVED_ICON

  const kind = node.type === 'light' ? node.light.kind : node.geometry.kind
  return (primitiveByKind(kind) ?? lightByKind(kind))?.icon ?? mdiCubeOutline
}

/**
 * One node from one registry entry, whichever registry knows the kind. The toolbar, the panels
 * and the native menu all add through here: three call sites building a node their own way is
 * three ways for a mesh to arrive without a material.
 *
 * A kind no registry claims, or one declared but not buildable yet, yields `null` rather than a
 * node with nothing in it.
 */
export function createNodeOf(kind: string): SceneNode | null {
  const primitive = primitiveByKind(kind)
  if (primitive) return meshNode(primitive.create())

  if (kind === 'camera') return cameraNode()
  if (kind === 'sprite') return spriteNode()
  if (kind === 'text') return textNode()
  if (kind === 'path') return pathNode()

  const light = lightByKind(kind)
  return light ? lightNode(light.create(), IDENTITY_TRANSFORM.position) : null
}
