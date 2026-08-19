/**
 * Where the studio's work can go, and what it costs to send it there.
 *
 * One entry per (section, target) pair. It answers the three questions a person asks before
 * clicking: what file comes out, how it reaches the other application, and what does not survive
 * the trip. The surfaces read this rather than each holding their own list, so a target added
 * here needs no new component and no new channel.
 */

import {
  capabilityOf,
  lossesAgainst,
  MATERIAL_TRAITS,
  SCENE_TRAITS,
  SKY_TRAITS,
  type CapabilityDomain,
  type CapabilityTrait,
  type FormatCapability,
  type MaterialTrait,
} from './formatCapability'
import type { ExportFormat as SceneExportFormat } from './scene'
import type { PbrChannel } from './texture'
import { bakesRemap, channelsWrittenBy, type TextureExportTarget } from './textureExport'

/** A (section, target) pair. Named for the section first, so the list reads by surface. */
export type ExportTargetId =
  | 'picture.png'
  | 'scene.glb'
  | 'scene.gltf'
  | 'scene.usdz'
  | 'sky.faces'
  | 'material.gltf'
  | 'material.unity'
  | 'material.unreal'
  | 'material.roblox'
  | 'material.raw'
  | 'montage.otio'

export const EXPORT_TARGET_IDS: readonly ExportTargetId[] = [
  'picture.png',
  'scene.glb',
  'scene.gltf',
  'scene.usdz',
  'sky.faces',
  'material.gltf',
  'material.unity',
  'material.unreal',
  'material.roblox',
  'material.raw',
  'montage.otio',
]

/**
 * How an artefact reaches the application it was written for. The distinction is the whole point
 * of this table: a file that is perfectly valid still opens nothing when nobody declared it.
 *
 * `declared` — the target application registered the extension with the system, so a double-click
 * opens it. `import` — it opens only through the target's own file picker, which works always and
 * costs the person knowing where to click. `script` — the target exposes an automation the studio
 * drives itself.
 */
export type ExportDoor = 'declared' | 'import' | 'script'

/**
 * One file the save dialog names, or a folder of files that mean nothing apart — five faces of a
 * sky are not a sky, and a base colour without its ORM is half a material.
 */
export type ExportDestination = 'file' | 'folder'

export type ExportTarget = {
  domain: CapabilityDomain
  /** What comes out. Several when one export writes a folder of files under one extension. */
  extension: string
  door: ExportDoor
  destination: ExportDestination
  /**
   * The applications this machine answered for the extension, measured on 2026-08-19 through
   * LaunchServices rather than by reading `CFBundleDocumentTypes` — which misses a target that
   * declares a UTI instead of an extension, and reported nothing for half of these.
   *
   * Informative, and deliberately untested: it describes one machine on one day. What a guard can
   * hold is `door`, which is a decision; this is the evidence behind it.
   */
  openedBy: readonly string[]
  capability: FormatCapability
}

/**
 * A scene leaves as the OBJECTS the viewport draws, never as the document — `sceneExport.ts`
 * hands three.js the copies, so the `extras` a saved `.gltf` carries are not in an export at all.
 *
 * `primitiveShape` is the one that reads oddly: a cube still arrives, as a mesh. What is dropped
 * is that it WAS a cube, which is the trait.
 */
const GLTF_SCENE_EXPORT: FormatCapability = {
  domain: 'scene',
  interchange: [
    'sceneTree',
    'nodeName',
    'nodePlacement',
    'cameraLens',
    'punctualLight',
    'nodeMaterial',
    'sceneAnimation',
  ],
  extended: [],
  dropped: ['ambientLight', 'primitiveShape', 'cameraPath', 'cameraShot', 'sceneEnvironment'],
}

/**
 * The same, minus every light: `USDZExporter` writes meshes, materials and cameras, and holds no
 * spelling for a light at all — read off the exporter of three 0.185, which never tests `isLight`.
 */
const USDZ_SCENE_EXPORT: FormatCapability = {
  domain: 'scene',
  interchange: [
    'sceneTree',
    'nodeName',
    'nodePlacement',
    'cameraLens',
    'nodeMaterial',
    'sceneAnimation',
  ],
  extended: [],
  dropped: [
    'punctualLight',
    'ambientLight',
    'primitiveShape',
    'cameraPath',
    'cameraShot',
    'sceneEnvironment',
  ],
}

/**
 * Six square pictures. The grading is BAKED rather than carried — it survives as an appearance
 * and never as a setting — and everything the sun and the environment hold is left behind.
 */
const SKY_FACES_EXPORT: FormatCapability = {
  domain: 'sky',
  interchange: ['skyImage', 'skyGrading'],
  extended: [],
  dropped: [
    'sunAngles',
    'sunIntensity',
    'sunColour',
    'environmentIntensity',
    'backgroundVisible',
    'skyGeneration',
  ],
}

const TRAIT_OF_CHANNEL: Record<PbrChannel, MaterialTrait> = {
  baseColor: 'colourMap',
  normal: 'normalMap',
  roughness: 'roughnessMap',
  metalness: 'metalnessMap',
  ao: 'occlusionMap',
  height: 'heightMap',
  emissive: 'emissiveMap',
  edge: 'cavityMap',
}

/**
 * Derived from the recipes rather than listed beside them: what a texture target carries is
 * exactly the channels it reads, and a sixth engine added to `textureExport` gets its losses for
 * free instead of getting them wrong.
 *
 * `valueRanges` rides with them when the target bakes the remap — the window a channel was judged
 * through leaves inside the pixels, which is why `raw` is the one target that loses it.
 */
function materialCapability(target: TextureExportTarget): FormatCapability {
  const carried: CapabilityTrait[] = channelsWrittenBy(target).map(
    channel => TRAIT_OF_CHANNEL[channel],
  )
  const judged: CapabilityTrait = 'valueRanges'
  const interchange: CapabilityTrait[] = bakesRemap(target) ? [...carried, judged] : carried

  return {
    domain: 'material',
    interchange,
    extended: [],
    dropped: MATERIAL_TRAITS.filter(trait => !interchange.includes(trait)),
  }
}

const TARGETS: Record<ExportTargetId, ExportTarget> = {
  'picture.png': {
    domain: 'picture',
    extension: '.png',
    door: 'declared',
    destination: 'folder',
    openedBy: ['Preview', 'GIMP', 'Safari', 'Firefox', 'Google Chrome'],
    capability: capabilityOf('png'),
  },
  'scene.glb': {
    domain: 'scene',
    extension: '.glb',
    door: 'declared',
    destination: 'file',
    openedBy: ['Preview'],
    capability: GLTF_SCENE_EXPORT,
  },
  'scene.gltf': {
    domain: 'scene',
    extension: '.gltf',
    door: 'declared',
    destination: 'file',
    openedBy: ['Preview', 'Xcode', 'Google Chrome'],
    capability: GLTF_SCENE_EXPORT,
  },
  'scene.usdz': {
    domain: 'scene',
    extension: '.usdz',
    door: 'declared',
    destination: 'file',
    openedBy: ['Xcode', 'Preview'],
    capability: USDZ_SCENE_EXPORT,
  },
  'sky.faces': {
    domain: 'sky',
    extension: '.png',
    door: 'declared',
    destination: 'folder',
    openedBy: ['Preview', 'GIMP', 'Safari', 'Firefox', 'Google Chrome'],
    capability: SKY_FACES_EXPORT,
  },
  'material.gltf': {
    domain: 'material',
    extension: '.glb',
    door: 'declared',
    destination: 'folder',
    openedBy: ['Preview'],
    capability: materialCapability('gltf'),
  },
  'material.unity': {
    domain: 'material',
    extension: '.png',
    door: 'import',
    destination: 'folder',
    openedBy: [],
    capability: materialCapability('unity'),
  },
  'material.unreal': {
    domain: 'material',
    extension: '.png',
    door: 'import',
    destination: 'folder',
    openedBy: [],
    capability: materialCapability('unreal'),
  },
  'material.roblox': {
    domain: 'material',
    extension: '.png',
    door: 'import',
    destination: 'folder',
    openedBy: [],
    capability: materialCapability('roblox'),
  },
  'material.raw': {
    domain: 'material',
    extension: '.png',
    door: 'import',
    destination: 'folder',
    openedBy: [],
    capability: materialCapability('raw'),
  },
  /**
   * `import` rather than `declared`, and the two measurements disagree: LaunchServices offers
   * DaVinci Resolve for a `.otio`, while Resolve's own `CFBundleDocumentTypes` lists neither it
   * nor `.otioz`, and Resolve ignores a file handed to it on the command line — it opens its
   * project manager. The picker is what actually works, so that is what this promises.
   */
  'montage.otio': {
    domain: 'montage',
    extension: '.otio',
    door: 'import',
    destination: 'file',
    openedBy: [],
    capability: capabilityOf('otio'),
  },
}

export const exportTargetOf = (id: ExportTargetId): ExportTarget => TARGETS[id]

/**
 * The two unions that named a target before this table existed, mapped onto it. Records rather
 * than a composed `scene.${format}`: a template string types as `string`, and the compiler is
 * what stops a sixth engine from reaching a target nobody declared.
 */
export const SCENE_TARGET_OF_FORMAT: Record<SceneExportFormat, ExportTargetId> = {
  glb: 'scene.glb',
  gltf: 'scene.gltf',
  usdz: 'scene.usdz',
}

export const MATERIAL_TARGET_OF: Record<TextureExportTarget, ExportTargetId> = {
  gltf: 'material.gltf',
  unity: 'material.unity',
  unreal: 'material.unreal',
  roblox: 'material.roblox',
  raw: 'material.raw',
}

/** The targets one section offers, in the order they were declared. */
export function targetsOfDomain(domain: CapabilityDomain): ExportTargetId[] {
  return EXPORT_TARGET_IDS.filter(id => TARGETS[id].domain === domain)
}

/**
 * What sending `traits` to this target would destroy — the sentence a dialog says BEFORE the
 * click, rather than a line in a journal nobody reads afterwards.
 */
export function lossesExportingTo(
  traits: readonly CapabilityTrait[],
  id: ExportTargetId,
): CapabilityTrait[] {
  return lossesAgainst(traits, TARGETS[id].capability)
}

/** Every trait a section has, which is what a document is measured against when it has none. */
export const TRAITS_TO_DECLARE: Record<'scene' | 'sky' | 'material', readonly CapabilityTrait[]> = {
  scene: SCENE_TRAITS,
  sky: SKY_TRAITS,
  material: MATERIAL_TRAITS,
}
