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
  GLTF_VERSION,
  KHR_LIGHTS_PUNCTUAL,
  type GltfDocument,
  type GltfNode,
} from '@shared/domain/gltf'
import { STUDIO_METADATA_KEY } from '@shared/domain/document'
import { isRecord, readNumber, readString } from '@shared/guards'
import { createSkyboxContent, DEFAULT_SUN, type SkyboxContent } from '@shared/domain/skybox'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { parseSkybox } from './skyboxState'

/**
 * A sky as glTF holds it, and back.
 *
 * The split is the one OpenRaster already draws: the standard part is what ANOTHER application
 * reads — a directional light for the sun, a node rotation for the horizon — and the studio's own
 * state rides verbatim in `extras`, so reopening is one parse and no rule is kept in step on two
 * sides.
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
   * has none yet. The file is REFERENCED and never embedded.
   *
   * NOT in `images`, and the reason is conformance: glTF 2.0 § 3.9 knows JPEG and PNG and nothing
   * else, and an `images` entry no `texture` points at is what the official validator calls an
   * unused object. It hangs off the node it turns with instead, in the place the specification
   * reserves for applications.
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
      ...(sourceUri ? { extras: { [STUDIO_METADATA_KEY]: { source: sourceUri } } } : {}),
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
    extensionsUsed: [KHR_LIGHTS_PUNCTUAL],
    extensions: {
      [KHR_LIGHTS_PUNCTUAL]: {
        lights: [
          {
            type: 'directional',
            name: SUN_NODE,
            color: linearRgbOf(content.sun.color),
            /**
             * The studio's own dial, and NOT the lux the extension asks a directional light for.
             * Measured on three.js 0.185, which is the only glTF reader on this machine and the
             * renderer this studio is built on: its exporter writes `light.intensity` unchanged
             * and its loader reads it back unchanged. Converting would mean inventing a reference
             * illuminance nothing here measures. A consumer that honours the unit reads a dim sun.
             */
            intensity: content.sun.intensity,
          },
        ],
      },
    },
    extras: { [STUDIO_METADATA_KEY]: content },
  }
}

/** The uri the file points its picture at, or `''` — what a foreign sky is relinked from. */
export function skySourceUri(payload: unknown): string {
  const horizon = nodesOf(payload).find(node => readString(node, 'name', '') === HORIZON_NODE)
  return readString(gltfStudioExtras(horizon?.extras), 'source', '')
}

const nodesOf = (payload: unknown): Record<string, unknown>[] =>
  isRecord(payload) && Array.isArray(payload.nodes) ? payload.nodes.filter(isRecord) : []

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
  const nodes = nodesOf(payload)
  const lights = gltfPunctualLights(payload)
  const at = lights.findIndex(light => readString(light, 'type', '') === 'directional')
  const light = at === -1 ? undefined : lights[at]
  const sun = at === -1 ? undefined : nodes.find(node => lightIndexOf(node) === at)
  const horizon = nodes.find(node => readString(node, 'name', '') === HORIZON_NODE)

  return {
    ...createSkyboxContent(),
    ...(assetId ? { source: { assetId } } : {}),
    adjustments: { ...NEUTRAL_ADJUSTMENTS, rotationY: angleAboutY(rotationOf(horizon)) },
    // A sun whose node carries no rotation of its own keeps the DEFAULT rather than the angles an
    // identity stands for — due north on the horizon, which is an answer and not an absence.
    sun:
      light && sun?.rotation
        ? {
            ...anglesFromDirection(directionOfQuaternion(rotationOf(sun)), DEFAULT_SUN),
            intensity: readNumber(light, 'intensity', DEFAULT_SUN.intensity),
            color: colourIn(light.color),
          }
        : { ...DEFAULT_SUN },
  }
}

/**
 * A light's colour, or white — which is the extension's OWN default and also the studio's.
 *
 * Read by index with a fallback rather than filtered: a triplet holding one value that is not a
 * number would come out SHORTER, and the channels after it would each shift up one.
 */
function colourIn(colour: unknown): string {
  if (!Array.isArray(colour)) return DEFAULT_SUN.color
  return colourFromLinearRgb([0, 1, 2].map(at => (typeof colour[at] === 'number' ? colour[at] : 1)))
}

/** Which light of the root list a node carries, or `-1` for a node carrying none. */
function lightIndexOf(node: Record<string, unknown>): number {
  const extensions = node.extensions
  if (!isRecord(extensions)) return -1
  const held = extensions[KHR_LIGHTS_PUNCTUAL]
  return isRecord(held) && typeof held.light === 'number' ? held.light : -1
}

const IDENTITY_ROTATION = [0, 0, 0, 1]

/**
 * A node's own rotation. `[0,0,0,1]` for one that has none, which is what glTF says.
 *
 * **Two blind spots, written rather than hidden**: a node may carry a `matrix` INSTEAD of the three
 * components — many exporters write one — and a light may hang under a parent that is itself
 * turned. Neither is read here, and the caller answers the default sun rather than a wrong one
 * whenever there is no `rotation` at all. A node carrying both a `matrix` and a rotation of its own
 * is the case still unaccounted for, and glTF forbids it.
 */
function rotationOf(node: Record<string, unknown> | undefined): number[] {
  const rotation = node?.rotation
  if (!Array.isArray(rotation)) return IDENTITY_ROTATION
  return IDENTITY_ROTATION.map((fallback, index) =>
    typeof rotation[index] === 'number' ? rotation[index] : fallback,
  )
}
