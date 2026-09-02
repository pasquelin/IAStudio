import { mdiCubeOutline } from '@mdi/js'
import type {
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  Transform,
  Vector3,
} from '@shared/domain/scene'
import { DEFAULT_CAMERA, DEFAULT_PATH } from '@shared/domain/scene'
import type { CsgGraph } from '@shared/domain/csg'
import { COMPONENTS, newComponent } from '@shared/domain/componentRegistry'
import { newId } from '@/helpers/ids'
import { defaultMeshMaterial } from './checkerTextures'
import { lightByKind } from './lightTypes'
import { primitiveByKind } from './meshPrimitives'
import { isPlayerModule, PLAYER_KIND } from './playerModule'
import {
  CAMERA_ICON,
  CARVED_ICON,
  GROUP_ICON,
  MODEL_ICON,
  PATH_ICON,
  PLAYER_ICON,
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
    negative = false,
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
    // A node is BORN unmarked, and absent is what that means — so a fresh box carries no field.
    ...(negative ? { negative } : {}),
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
  /** Marked as a tool for the next boolean — see `SceneNode`. What `separateNode` gives back. */
  negative?: boolean
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

/** A solid, standing where the matter it was cut from stood, and wearing its material. */
export function carvedNode(
  carved: CsgGraph,
  {
    transform = IDENTITY_TRANSFORM,
    material = DEFAULT_MATERIAL,
    parentId = null,
    name = 'Solid',
    negative = false,
  }: {
    transform?: Transform
    material?: MaterialDescriptor
    parentId?: string | null
    name?: string
    negative?: boolean
  } = {},
): SceneNode {
  return {
    id: newId(),
    parentId,
    name,
    visible: true,
    transform,
    ...shadowDefaults({ type: 'carved' }),
    type: 'carved',
    carved,
    material,
    ...(negative ? { negative } : {}),
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

/**
 * The capsule draws nothing of its own: `CharacterController` already carries the height and the
 * radius the physics feels, and what is SEEN is the mesh under it, which a model replaces.
 */
export function playerModuleNodes(): readonly SceneNode[] {
  const module: SceneNode = {
    ...groupNode(IDENTITY_TRANSFORM, 'Player_Module'),
    components: [newComponent('Player')],
  }
  const capsule: SceneNode = {
    // Half the controller's own height: a capsule stands ON the ground, and its node is its centre.
    ...groupNode(transformAt({ x: 0, y: WALKER_HEIGHT / 2, z: 0 }), 'Capsule'),
    parentId: module.id,
    components: [newComponent('CharacterController')],
  }
  // three.js measures a capsule by its CYLINDER, so the caps are what the two radii add back.
  const mesh = meshNode(
    {
      kind: 'capsule',
      radius: WALKER_RADIUS,
      height: WALKER_HEIGHT - 2 * WALKER_RADIUS,
      capSegments: 8,
      radialSegments: 16,
    },
    { parentId: capsule.id, name: 'Mesh' },
  )
  const arm: SceneNode = { ...groupNode(IDENTITY_TRANSFORM, 'SpringArm'), parentId: module.id }
  const camera: SceneNode = { ...cameraNode(IDENTITY_TRANSFORM), parentId: arm.id }

  return [
    module,
    capsule,
    mesh,
    // 🛑 By ID, never by name: `entityNamed` reads the id first and the name after, and every
    // scene the studio ships already holds a node called `Camera` — which a name would capture.
    {
      ...arm,
      components: [{ ...newComponent('SpringArm'), subject: capsule.id, camera: camera.id }],
    },
    camera,
  ]
}

/** The controller's own defaults, read rather than copied: tuning one there moves the body here. */
const WALKER_HEIGHT = Number(COMPONENTS.CharacterController.defaults.height)
const WALKER_RADIUS = Number(COMPONENTS.CharacterController.defaults.radius)

/** The glyph belongs to the registry entry, not to whichever panel happens to draw the node. */
export function iconOf(node: SceneNode): string {
  // Before the type, and it is the only glyph read off a component: a module wearing a folder is
  // a module nobody finds in an outliner of thirty rows.
  if (isPlayerModule(node)) return PLAYER_ICON
  if (node.type === 'model') return MODEL_ICON
  if (node.type === 'group') return GROUP_ICON
  if (node.type === 'sprite') return SPRITE_ICON
  if (node.type === 'text') return TEXT_ICON
  if (node.type === 'camera') return CAMERA_ICON
  if (node.type === 'path') return PATH_ICON
  if (node.type === 'carved') return CARVED_ICON

  // Named rather than assumed: the fallthrough used to read `node.setPrimitiveParameters` on anything that was
  // not a light, so the next member of the union would have crashed here instead of taking the
  // default glyph.
  if (node.type === 'light') return lightByKind(node.light.kind)?.icon ?? mdiCubeOutline
  if (node.type !== 'mesh') return mdiCubeOutline
  return primitiveByKind(node.geometry.kind)?.icon ?? mdiCubeOutline
}

/**
 * What one Add gives the scene, and the door the toolbar, the panels and the native menu share —
 * three call sites building a node their own way is three ways for a mesh to arrive without a
 * material. A LIST, because a module is several nodes born parented.
 */
export function createNodesOf(kind: string): readonly SceneNode[] {
  if (kind === PLAYER_KIND) return playerModuleNodes()

  const node = createNodeOf(kind)
  return node ? [node] : []
}

/** The single-node half of the door above. Nothing adds through this one — see `createNodesOf`. */
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
