import { directionFromAngles, anglesFromDirection } from '@shared/domain/angles'
import { colourFromLinearRgb, linearRgbOf } from '@shared/domain/color'
import {
  angleAboutY,
  directionOfQuaternion,
  gltfPunctualLights,
  gltfStudioExtras,
  quaternionAboutY,
  quaternionTowards,
  GLTF_GENERATOR,
  GLTF_STUDIO_KEY,
  GLTF_VERSION,
  KHR_LIGHTS_PUNCTUAL,
  type GltfDocument,
  type GltfNode,
} from '@shared/domain/gltf'
import { isRecord, readNumber, readString } from '@shared/guards'
import { createSkyboxContent, DEFAULT_SUN, type SkyboxContent } from '@shared/domain/skybox'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { parseSkybox } from './skyboxState'

/**
 * A sky as glTF holds it, and back.
 *
 * The split is the one OpenRaster already draws: the standard part is what ANOTHER application
 * reads — a directional light for the sun, a node rotation for the horizon, a referenced image for
 * the picture — and the studio's own state rides verbatim in `extras`, so reopening is one parse
 * and no rule is kept in step on two sides.
 *
 * **What that costs, written rather than hidden**: the horizon rotation is therefore in the file
 * TWICE, once as a node and once inside `extras`. A file of ours reads the second; only a file
 * with no `extras` of ours is rebuilt from the first. Hand-editing the node alone changes what
 * another application draws and nothing the studio does.
 */

/** Where the equirectangular picture hangs, and what carries the horizon rotation. */
const HORIZON_NODE = 'Horizon'

const SUN_NODE = 'Sun'

export type SkyGltfOptions = {
  /** The document's title, which is what a reader shows for the scene. */
  name: string
  /**
   * Where the source picture sits, relative to the document's own folder — `null` for a sky that
   * has none yet. The file is REFERENCED and never embedded: a `.hdr` is the one thing in this
   * document another application can already open.
   */
  sourceUri: string | null
}

export function gltfSkyOf(
  content: SkyboxContent,
  { name, sourceUri }: SkyGltfOptions,
): GltfDocument {
  const nodes: GltfNode[] = [
    {
      name: HORIZON_NODE,
      rotation: quaternionAboutY(content.adjustments.rotationY),
      // The picture is named on the node it turns with. glTF core has no environment at all, so
      // this is a place to look rather than a slot a reader already knows.
      ...(sourceUri ? { extras: { [GLTF_STUDIO_KEY]: { image: 0 } } } : {}),
    },
    {
      name: SUN_NODE,
      rotation: quaternionTowards(directionFromAngles(content.sun)),
      extensions: { [KHR_LIGHTS_PUNCTUAL]: { light: 0 } },
    },
  ]

  return {
    asset: { version: GLTF_VERSION, generator: GLTF_GENERATOR },
    scene: 0,
    scenes: [{ name, nodes: [0, 1] }],
    nodes,
    ...(sourceUri ? { images: [{ uri: sourceUri, name }] } : {}),
    extensionsUsed: [KHR_LIGHTS_PUNCTUAL],
    extensions: {
      [KHR_LIGHTS_PUNCTUAL]: {
        lights: [
          {
            type: 'directional',
            name: SUN_NODE,
            color: linearRgbOf(content.sun.color),
            intensity: content.sun.intensity,
          },
        ],
      },
    },
    extras: { [GLTF_STUDIO_KEY]: content },
  }
}

/** The uri the file points its picture at, or `''` — what a foreign sky is relinked from. */
export function skySourceUri(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.images)) return ''
  const first = payload.images[0]
  return isRecord(first) ? readString(first, 'uri', '') : ''
}

/**
 * A sky read back off its file.
 *
 * A file of ours answers from `extras`, which holds the whole state — including the dials no glTF
 * field has. A file from anywhere else is rebuilt from the standard part alone, exactly as a `.ora`
 * written elsewhere is rebuilt from `stack.xml`: what the standard cannot say is simply absent.
 */
export function skyFromGltf(payload: unknown, assetIdOf: (uri: string) => string): SkyboxContent {
  const studio = gltfStudioExtras(isRecord(payload) ? payload.extras : null)
  const uri = skySourceUri(payload)

  if (Object.keys(studio).length > 0) {
    const held = parseSkybox(studio)
    // The PATH first and the id second, unlike the id the file also carries: a sky copied into
    // another project keeps an id that names nothing there, while the picture beside it is found.
    // The id is kept when nothing answers the path — this window's catalogue holds only what it
    // has been SHOWN, so dropping the link would lose it for good at the next ⌘S.
    const relinked = uri ? assetIdOf(uri) : ''
    return relinked ? { ...held, source: { assetId: relinked } } : held
  }

  return foreignSky(payload, uri ? assetIdOf(uri) : '')
}

/**
 * A sky rebuilt from the standard part alone.
 *
 * The sun is looked for by the LIGHT it carries rather than by the node's name: a file written
 * elsewhere calls its nodes whatever it likes, and the extension is what says which one is a sun.
 * A file naming no directional light has no sun to read, and keeps the default rather than one
 * derived from an identity rotation — which would stand it due north, on the horizon.
 */
function foreignSky(payload: unknown, assetId: string): SkyboxContent {
  const nodes =
    isRecord(payload) && Array.isArray(payload.nodes) ? payload.nodes.filter(isRecord) : []
  const lights = gltfPunctualLights(payload)
  const at = lights.findIndex(light => readString(light, 'type', '') === 'directional')
  const light = at === -1 ? undefined : lights[at]
  const sun = at === -1 ? undefined : nodes.find(node => lightIndexOf(node) === at)
  const horizon = nodes.find(node => readString(node, 'name', '') === HORIZON_NODE)

  return {
    ...createSkyboxContent(),
    ...(assetId ? { source: { assetId } } : {}),
    adjustments: { ...NEUTRAL_ADJUSTMENTS, rotationY: angleAboutY(rotationOf(horizon)) },
    sun: light
      ? {
          ...anglesFromDirection(directionOfQuaternion(rotationOf(sun)), DEFAULT_SUN),
          intensity: readNumber(light, 'intensity', DEFAULT_SUN.intensity),
          color: Array.isArray(light.color)
            ? colourFromLinearRgb(light.color.filter(one => typeof one === 'number'))
            : DEFAULT_SUN.color,
        }
      : { ...DEFAULT_SUN },
  }
}

/** Which light of the root list a node carries, or `-1` for a node carrying none. */
function lightIndexOf(node: Record<string, unknown>): number {
  const extensions = node.extensions
  if (!isRecord(extensions)) return -1
  const held = extensions[KHR_LIGHTS_PUNCTUAL]
  return isRecord(held) && typeof held.light === 'number' ? held.light : -1
}

const IDENTITY_ROTATION = [0, 0, 0, 1]

/** `[0,0,0,1]` for a node with none, which is what glTF says an absent rotation means. */
function rotationOf(node: Record<string, unknown> | undefined): number[] {
  const rotation = node?.rotation
  if (!Array.isArray(rotation)) return IDENTITY_ROTATION
  return IDENTITY_ROTATION.map((fallback, index) =>
    typeof rotation[index] === 'number' ? rotation[index] : fallback,
  )
}
