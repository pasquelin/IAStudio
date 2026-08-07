import { newId } from '@/helpers/ids'
import { lightByKind } from './light-types'
import { primitiveByKind } from './mesh-primitives'
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

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }

/** i18n key of what a kind is called, from whichever registry knows it — never the text. */
export function labelKeyOf(kind: string): string | null {
  return primitiveByKind(kind)?.labelKey ?? lightByKind(kind)?.labelKey ?? null
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
    if (!primitive.create) return null
    return {
      id: newId(),
      parentId: null,
      name,
      visible: true,
      transform: IDENTITY_TRANSFORM,
      type: 'mesh',
      geometry: primitive.create(),
      material: DEFAULT_MATERIAL,
    }
  }

  const light = lightByKind(kind)
  return light ? lightNode(light.create(), ORIGIN, name) : null
}
