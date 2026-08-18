/**
 * The scene as glTF holds it — which IS the scene document, not an export beside one.
 *
 * The standard carries the tree, the placements, the cameras and the punctual lights; everything
 * past that rides in the `extras` of the scene, which the format says a reader may ignore.
 *
 * Geometry is NOT baked: a mesh is a named node with its primitive in `extras`. Baking needs the
 * engine, which a save of an unmounted tab has not got — `sceneExport.ts` is what bakes.
 */
import { Color, Euler, Quaternion } from 'three'
import {
  DOCUMENT_ID_KEY,
  DOCUMENT_KIND_KEY,
  STUDIO_METADATA_KEY,
  type DocumentKind,
} from '@shared/domain/document'
import { GLTF_SCENE_STATE, gltfStudioMetadata, isGltfDocument } from '@shared/domain/gltf'
import type { LightDescriptor, Transform } from '@shared/domain/scene'
import { scenePayload, sceneFromPayload } from './sceneDocument'
import type { SceneState } from './sceneState'

/** What the studio writes into a file, so a reader knows which build made it. */
const GENERATOR = 'Scenario Studio'

const GLTF_VERSION = '2.0'

/** The extension every punctual light of the file is declared under. */
const LIGHTS_EXTENSION = 'KHR_lights_punctual'

type GltfNode = {
  name: string
  /** Three numbers, four for the quaternion — the format's own lengths, not restated as tuples. */
  translation?: readonly number[]
  rotation?: readonly number[]
  scale?: readonly number[]
  children?: readonly number[]
  camera?: number
  extensions?: { [LIGHTS_EXTENSION]: { light: number } }
}

type GltfCamera = {
  type: 'perspective'
  name: string
  /** Vertical field of view in RADIANS, where a camera descriptor holds degrees. */
  perspective: { yfov: number; znear: number; zfar: number }
}

/** An absent `range` means a light that reaches everywhere, on both sides. */
type GltfLight = {
  type: 'directional' | 'point' | 'spot'
  name: string
  color: readonly [number, number, number]
  intensity: number
  range?: number
  spot?: { innerConeAngle: number; outerConeAngle: number }
}

export type GltfDocumentOptions = {
  documentId: string
  /** Which of the two kinds this container serves. The file name cannot say. */
  documentKind: DocumentKind
}

/**
 * The scene as a file holds it. The scene's NAME is left to the file layer, which stamps it from
 * the document's title on every write — the same rule the montage follows, and what makes a
 * rename reach the field another application shows.
 */
export function gltfDocumentOf(
  state: SceneState,
  { documentId, documentKind }: GltfDocumentOptions,
): unknown {
  const cameras: GltfCamera[] = []
  const lights: GltfLight[] = []
  // Once for the whole scene, never once per node: asking each node which others hang from it is
  // n² comparisons on the thread that draws — measured 18/08 at 27,6 ms for 1 000 nodes and
  // 367 ms for 5 000, against 0,06 and 1,2 this way.
  const childrenOfNode = new Map<string | null, number[]>()
  state.nodes.forEach((node, at) => {
    const siblings = childrenOfNode.get(node.parentId)
    if (siblings) siblings.push(at)
    else childrenOfNode.set(node.parentId, [at])
  })

  const nodes = state.nodes.map(node => {
    const written: GltfNode = { name: node.name, ...placement(node.transform) }

    const children = childrenOfNode.get(node.id)
    if (children) written.children = children

    if (node.type === 'camera') {
      written.camera = cameras.length
      cameras.push({
        type: 'perspective',
        name: node.name,
        perspective: {
          yfov: (node.camera.fov * Math.PI) / 180,
          znear: node.camera.near,
          zfar: node.camera.far,
        },
      })
    }

    const light = node.type === 'light' ? punctualLight(node.name, node.light) : null
    if (light) {
      written.extensions = { [LIGHTS_EXTENSION]: { light: lights.length } }
      lights.push(light)
    }

    return written
  })

  return {
    asset: { version: GLTF_VERSION, generator: GENERATOR },
    scene: 0,
    scenes: [
      {
        nodes: childrenOfNode.get(null) ?? [],
        extras: {
          [STUDIO_METADATA_KEY]: {
            [DOCUMENT_ID_KEY]: documentId,
            [DOCUMENT_KIND_KEY]: documentKind,
            [GLTF_SCENE_STATE]: scenePayload(state),
          },
        },
      },
    ],
    nodes,
    ...(cameras.length > 0 ? { cameras } : {}),
    ...(lights.length > 0
      ? {
          extensionsUsed: [LIGHTS_EXTENSION],
          extensions: { [LIGHTS_EXTENSION]: { lights } },
        }
      : {}),
  }
}

/**
 * The scene a saved document holds, in whichever of the two spellings its file was written in —
 * decided by the payload rather than by the extension, so a file renamed by hand opens as what it
 * is. A project holds scenes saved before the studio wrote glTF, and they open unchanged.
 */
export function sceneFromGltf(document: unknown): SceneState {
  if (!isGltfDocument(document)) return sceneFromPayload(document)

  return sceneFromPayload(gltfStudioMetadata(document)[GLTF_SCENE_STATE])
}

/** Fields at their default are left out. The rotation is Euler here, a quaternion there. */
function placement({ position, rotation, scale }: Transform): Partial<GltfNode> {
  const quaternion = new Quaternion().setFromEuler(new Euler(rotation.x, rotation.y, rotation.z))

  return {
    ...(position.x || position.y || position.z
      ? { translation: [position.x, position.y, position.z] }
      : {}),
    ...(quaternion.x || quaternion.y || quaternion.z || quaternion.w !== 1
      ? { rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] }
      : {}),
    ...(scale.x !== 1 || scale.y !== 1 || scale.z !== 1
      ? { scale: [scale.x, scale.y, scale.z] }
      : {}),
  }
}

/**
 * Ambient and hemisphere are not punctual, and writing one as a directional would light another
 * application's scene from a direction nobody chose. Both are still in the extras.
 */
function punctualLight(name: string, light: LightDescriptor): GltfLight | null {
  if (light.kind === 'ambient' || light.kind === 'hemisphere') return null

  const color = new Color(light.color)
  const written: GltfLight = {
    type: light.kind,
    name,
    color: [color.r, color.g, color.b],
    intensity: light.intensity,
  }

  if (light.kind === 'directional') return written

  return {
    ...written,
    // Zero means "reaches everywhere" on both sides, and the extension spells that by saying
    // nothing rather than by a zero, which it forbids.
    ...(light.distance > 0 ? { range: light.distance } : {}),
    ...(light.kind === 'spot'
      ? {
          spot: {
            innerConeAngle: light.angle * (1 - light.penumbra),
            outerConeAngle: light.angle,
          },
        }
      : {}),
  }
}
