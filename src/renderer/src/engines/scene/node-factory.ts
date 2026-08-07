import { mdiCubeOutline } from '@mdi/js'
import { newId } from '@/helpers/ids'
import { lightByKind, type LightType } from './light-types'
import { primitiveByKind, type MeshPrimitive } from './mesh-primitives'
import {
  DEFAULT_MATERIAL,
  IDENTITY_TRANSFORM,
  type LightDescriptor,
  type SceneNode,
  type Vector3,
} from './scene-state'

export function lightNode(light: LightDescriptor, position: Vector3, name?: string): SceneNode {
  return {
    id: newId(),
    parentId: null,
    // The three.js editor names a light after its class, and so does any scene exported from it.
    name: name ?? `${light.kind.charAt(0).toUpperCase()}${light.kind.slice(1)}Light`,
    visible: true,
    transform: { ...IDENTITY_TRANSFORM, position },
    type: 'light',
    light,
  }
}

/** The registry entry for a kind, whichever registry knows it. */
export function entryOf(kind: string): MeshPrimitive | LightType | null {
  return primitiveByKind(kind) ?? lightByKind(kind)
}

/** i18n key of what a kind is called — never the text. */
export function labelKeyOf(kind: string): string | null {
  return entryOf(kind)?.labelKey ?? null
}

/**
 * The glyph that says what a node is. It belongs to the registry entry, not to whichever panel
 * happens to draw the node: the outliner, the mesh panel and the light panel must not disagree
 * about what a sphere looks like.
 */
export function iconOf(node: SceneNode): string {
  const kind = node.type === 'light' ? node.light.kind : node.geometry.kind
  return entryOf(kind)?.icon ?? mdiCubeOutline
}

/**
 * One node from one registry entry, whichever registry knows the kind. The toolbar, the panels
 * and the native menu all add through here: three call sites building a node their own way is
 * three ways for a mesh to arrive without a material.
 *
 * The name comes from the caller because only it holds the translation — an engine that reached
 * for i18n would be an engine that knows about the interface. A kind no registry claims, or one
 * declared but not buildable yet, yields `null` rather than a node with nothing in it.
 */
export function createNodeOf(kind: string, name: string): SceneNode | null {
  const primitive = primitiveByKind(kind)
  if (primitive) {
    const geometry = primitive.create?.()
    if (!geometry) return null
    return {
      id: newId(),
      parentId: null,
      name,
      visible: true,
      transform: IDENTITY_TRANSFORM,
      type: 'mesh',
      geometry,
      material: DEFAULT_MATERIAL,
    }
  }

  const light = lightByKind(kind)
  return light ? lightNode(light.create(), IDENTITY_TRANSFORM.position, name) : null
}
