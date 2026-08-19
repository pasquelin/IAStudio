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
  type CapabilityDomain,
  type CapabilityTrait,
  type FormatCapability,
  type MaterialTrait,
} from './formatCapability'
import type { ExportFormat as SceneExportFormat } from './scene'
import type { PbrChannel } from './texture'
import {
  bakesRemap,
  channelsWrittenBy,
  writesOneFile,
  type TextureExportTarget,
} from './textureExport'

/** A (section, target) pair. Named for the section first, so the list reads by surface. */
export type ExportTargetId =
  | 'picture.png'
  | 'scene.glb'
  | 'scene.gltf'
  | 'scene.usdz'
  | 'scene.obj'
  | 'scene.ply'
  | 'scene.stl'
  | 'sky.faces'
  | 'material.gltf'
  | 'material.unity'
  | 'material.unreal'
  | 'material.roblox'
  | 'material.raw'
  | 'montage.otio'
  | 'montage.otioz'

export const EXPORT_TARGET_IDS: readonly ExportTargetId[] = [
  'picture.png',
  'scene.glb',
  'scene.gltf',
  'scene.usdz',
  'scene.obj',
  'scene.ply',
  'scene.stl',
  'sky.faces',
  'material.gltf',
  'material.unity',
  'material.unreal',
  'material.roblox',
  'material.raw',
  'montage.otio',
  'montage.otioz',
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
 *
 * `sceneAnimation` is dropped for a second reason, and it is the studio's own: `sceneExport.ts`
 * hands the clips to `parseAsync` on the glTF path ALONE, so a USDZ arrives as a still pose.
 */
const USDZ_SCENE_EXPORT: FormatCapability = {
  domain: 'scene',
  interchange: ['sceneTree', 'nodeName', 'nodePlacement', 'cameraLens', 'nodeMaterial'],
  extended: [],
  dropped: [
    'punctualLight',
    'ambientLight',
    'primitiveShape',
    'cameraPath',
    'cameraShot',
    'sceneAnimation',
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
 * The settings of a material rather than its maps. Only the target that BUILDS a material can
 * write them: `buildMaterial` sets the tint, the normal scale and the emissive strength on a
 * `MeshStandardMaterial`, and `placeTexture` the tiling and the rotation. A folder of pictures
 * has nowhere to put any of it.
 */
const MATERIAL_SETTINGS: readonly CapabilityTrait[] = [
  'baseTint',
  'uvTiling',
  'uvRotation',
  'normalScale',
  'emissiveStrength',
]

/**
 * Derived from the recipes rather than listed beside them: what a texture target carries is
 * exactly the channels it reads, and a sixth engine added to `textureExport` gets its losses for
 * free instead of getting them wrong.
 *
 * Three traits are carried by being BAKED rather than written, and they are classed the same way
 * for it: `valueRanges` when the target bakes the remap, `normalGreenFlip` wherever a normal goes
 * out at all — `resolveComponent` reconciles the convention in the pixels, remap or not.
 */
function materialCapability(target: TextureExportTarget): FormatCapability {
  const written = channelsWrittenBy(target)
  const interchange: CapabilityTrait[] = written.map(channel => TRAIT_OF_CHANNEL[channel])

  if (bakesRemap(target)) interchange.push('valueRanges')
  if (written.includes('normal')) interchange.push('normalGreenFlip')
  if (writesOneFile(target)) interchange.push(...MATERIAL_SETTINGS)

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
  /**
   * The three shape formats, and what they are FOR: a printer, a mesh tool, a physics engine. Each
   * is `import` rather than `declared` — none of the three is a format this machine hands to an
   * application on a double-click, and saying otherwise would promise an opening that never comes.
   */
  'scene.obj': {
    domain: 'scene',
    extension: '.obj',
    door: 'import',
    destination: 'file',
    openedBy: ['Blender', 'MeshLab'],
    capability: capabilityOf('obj'),
  },
  'scene.ply': {
    domain: 'scene',
    extension: '.ply',
    door: 'import',
    destination: 'file',
    openedBy: ['Blender', 'MeshLab'],
    capability: capabilityOf('ply'),
  },
  'scene.stl': {
    domain: 'scene',
    extension: '.stl',
    door: 'import',
    destination: 'file',
    openedBy: ['Blender', 'MeshLab'],
    capability: capabilityOf('stl'),
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
  /**
   * The same cut with its media inside it, which is what settles the Media Pool: an `.otio` alone
   * arrives in Resolve as a timeline of files it then has to find. Nothing on this machine
   * declares the extension — measured 2026-08-19 — so the picker is the door, as for the `.otio`.
   */
  'montage.otioz': {
    domain: 'montage',
    extension: '.otioz',
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
  obj: 'scene.obj',
  ply: 'scene.ply',
  stl: 'scene.stl',
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
