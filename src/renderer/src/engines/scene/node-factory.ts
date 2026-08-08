import { mdiCubeOutline } from '@mdi/js'
import type { LightDescriptor, Vector3 } from '@shared/domain/scene'
import { newId } from '@/helpers/ids'
import { lightByKind } from './light-types'
import { primitiveByKind } from './mesh-primitives'
import { MODEL_ICON } from './node-kinds'
import { DEFAULT_MATERIAL, IDENTITY_TRANSFORM, shadowDefaults, type SceneNode } from './scene-state'

/**
 * A node is named after its class, as in the three.js editor — `Box`, `SpotLight` — and never
 * after the translated menu row that made it: a name is document data, and a scene whose
 * contents are called `Cube` in French and `Box` in English cannot be shared between the two.
 */
function classNameOf(kind: string): string {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
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

/** The glyph belongs to the registry entry, not to whichever panel happens to draw the node. */
export function iconOf(node: SceneNode): string {
  if (node.type === 'model') return MODEL_ICON

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
  if (primitive) {
    const geometry = primitive.create?.()
    if (!geometry) return null
    return {
      id: newId(),
      parentId: null,
      name: classNameOf(kind),
      visible: true,
      transform: IDENTITY_TRANSFORM,
      ...shadowDefaults({ type: 'mesh' }),
      type: 'mesh',
      geometry,
      material: DEFAULT_MATERIAL,
    }
  }

  const light = lightByKind(kind)
  return light ? lightNode(light.create(), IDENTITY_TRANSFORM.position) : null
}
