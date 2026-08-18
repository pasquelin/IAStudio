/**
 * What a file format can hold of an edited document, and what it would drop.
 *
 * The one place answering « can this format carry what this document contains? ». That answer
 * used to be written per kind in prose, and only the image acted on it — by flattening its stack
 * over the very source file it was opened from.
 */

import { extensionOf } from './fileName'

/**
 * The kind of document a trait and a format belong to. A format only ever answers about traits
 * of its own domain: an `.otio` carries no layer, and the answer for one is « everything lost »
 * rather than « nothing to lose ».
 */
export type CapabilityDomain = 'picture' | 'montage' | 'scene' | 'material'

/** A property of an edited picture that a format either carries or loses. */
export type PictureTrait =
  | 'layers'
  | 'groups'
  | 'layerMask'
  | 'adjustmentLayer'
  | 'liveText'
  | 'layerTransform'
  | 'blendMode'
  | 'layerOpacity'
  | 'clipping'
  | 'layerLock'
  | 'guides'

export const PICTURE_TRAITS: readonly PictureTrait[] = [
  'layers',
  'groups',
  'layerMask',
  'adjustmentLayer',
  'liveText',
  'layerTransform',
  'blendMode',
  'layerOpacity',
  'clipping',
  'layerLock',
  'guides',
]

/**
 * The same question for a montage. Measured against the OpenTimelineIO specification rather
 * than guessed — `.claude/spike-otio.md` holds the reading, trait by trait.
 *
 * `trackAudible` is the RESULT of mute and solo, which is what another application is told;
 * which of the two switches produced it is `trackSwitches`, and only this studio reads it back.
 */
export type MontageTrait =
  | 'tracks'
  | 'trackName'
  | 'trackOrder'
  | 'clipPlacement'
  | 'clipTrim'
  | 'clipSpeed'
  | 'mediaLink'
  | 'trackAudible'
  | 'clipFade'
  | 'clipGain'
  | 'clipLink'
  | 'trackSwitches'
  | 'trackLock'
  | 'trackHeight'
  | 'liveScene'
  | 'exactTime'
  | 'frameSize'
  | 'sampleRate'
  | 'editorState'

export const MONTAGE_TRAITS: readonly MontageTrait[] = [
  'tracks',
  'trackName',
  'trackOrder',
  'clipPlacement',
  'clipTrim',
  'clipSpeed',
  'mediaLink',
  'trackAudible',
  'clipFade',
  'clipGain',
  'clipLink',
  'trackSwitches',
  'trackLock',
  'trackHeight',
  'liveScene',
  'exactTime',
  'frameSize',
  'sampleRate',
  'editorState',
]

/**
 * The same question for a 3D scene. Read off what `gltfDocument.ts` actually writes, trait by
 * trait, rather than off the standard: the tree, the names, the placements, the perspective
 * cameras and the punctual lights are glTF fields, and everything else rides in the `extras` of
 * the scene — which the format says a reader may ignore.
 *
 * `ambientLight` is the one that surprises: `KHR_lights_punctual` has no spelling for an ambient
 * or a hemisphere light, so those two travel as studio data while the other three do not.
 */
export type SceneTrait =
  | 'sceneTree'
  | 'nodeName'
  | 'nodePlacement'
  | 'cameraLens'
  | 'punctualLight'
  | 'ambientLight'
  | 'primitiveShape'
  | 'nodeMaterial'
  | 'cameraPath'
  | 'cameraShot'
  | 'sceneAnimation'
  | 'sceneEnvironment'

export const SCENE_TRAITS: readonly SceneTrait[] = [
  'sceneTree',
  'nodeName',
  'nodePlacement',
  'cameraLens',
  'punctualLight',
  'ambientLight',
  'primitiveShape',
  'nodeMaterial',
  'cameraPath',
  'cameraShot',
  'sceneAnimation',
  'sceneEnvironment',
]

/**
 * The same question for a material, measured against the text of the MaterialX 1.39
 * specification — `.claude/spike-materialx.md` holds the reading.
 *
 * `occlusionMap` and `cavityMap` are the two that matter: `standard_surface` has NO input for
 * either, checked against the table in `MaterialX.PBRSpec.md`. They are carried, but only this
 * studio reads them back.
 */
export type MaterialTrait =
  | 'colourMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'normalMap'
  | 'heightMap'
  | 'emissiveMap'
  | 'baseTint'
  | 'uvTiling'
  | 'normalScale'
  | 'heightScale'
  | 'emissiveStrength'
  | 'occlusionMap'
  | 'cavityMap'
  | 'valueRanges'
  | 'normalGreenFlip'
  | 'uvRotation'
  | 'channelOrigin'
  | 'previewState'

export const MATERIAL_TRAITS: readonly MaterialTrait[] = [
  'colourMap',
  'roughnessMap',
  'metalnessMap',
  'normalMap',
  'heightMap',
  'emissiveMap',
  'baseTint',
  'uvTiling',
  'normalScale',
  'heightScale',
  'emissiveStrength',
  'occlusionMap',
  'cavityMap',
  'valueRanges',
  'normalGreenFlip',
  'uvRotation',
  'channelOrigin',
  'previewState',
]

export type CapabilityTrait = PictureTrait | MontageTrait | SceneTrait | MaterialTrait

export const CAPABILITY_TRAITS: readonly CapabilityTrait[] = [
  ...PICTURE_TRAITS,
  ...MONTAGE_TRAITS,
  ...SCENE_TRAITS,
  ...MATERIAL_TRAITS,
]

export const TRAITS_OF_DOMAIN: Record<CapabilityDomain, readonly CapabilityTrait[]> = {
  picture: PICTURE_TRAITS,
  montage: MONTAGE_TRAITS,
  scene: SCENE_TRAITS,
  material: MATERIAL_TRAITS,
}

/** A format the studio can write an edited document to. */
export type WritableFormat = 'png' | 'jpeg' | 'webp' | 'ora' | 'otio' | 'gltf' | 'mtlx'

export const WRITABLE_FORMATS: readonly WritableFormat[] = [
  'png',
  'jpeg',
  'webp',
  'ora',
  'otio',
  'gltf',
  'mtlx',
]

/**
 * Where each trait lands in a given format. The three lists PARTITION the traits — a guard holds
 * it — which is what stops a trait added later from reading as carried when nobody classed it.
 *
 * `interchange` and `extended` is the distinction the whole feature turns on: one says what
 * another application reads, the other what only this studio reads back. Saying « no loss »
 * without that split would promise a round trip through Krita that no format can keep.
 */
export type FormatCapability = {
  domain: CapabilityDomain
  /** Standard in this format, so another application reads it. */
  interchange: readonly CapabilityTrait[]
  /** Carried as studio data alongside the standard part: read back here, invisible elsewhere. */
  extended: readonly CapabilityTrait[]
  /** Not carried at all. Writing this format destroys it. */
  dropped: readonly CapabilityTrait[]
}

/** Nothing survives a flatten, so the three flat formats share one entry. */
const FLAT: FormatCapability = {
  domain: 'picture',
  interchange: [],
  extended: [],
  dropped: PICTURE_TRAITS,
}

/**
 * OpenRaster holds a stack of layers with a name, an offset, an opacity, a visibility and a
 * composite operation — and nothing else. Everything past that is Scenario data riding in the
 * same container, which is why a mask survives a save here but not a trip through another editor.
 *
 * `layerTransform` is extended rather than standard on purpose: ORA carries an integer x/y
 * offset, not the rotation, scale and skew a layer here can hold.
 */
const OPEN_RASTER: FormatCapability = {
  domain: 'picture',
  interchange: ['layers', 'groups', 'blendMode', 'layerOpacity'],
  extended: [
    'layerMask',
    'adjustmentLayer',
    'liveText',
    'layerTransform',
    'clipping',
    'layerLock',
    'guides',
  ],
  dropped: [],
}

/**
 * OpenTimelineIO holds the STRUCTURE of a cut, and it IS the montage document — there is no
 * spelling of the studio's own left beside it. Everything past that structure rides under the
 * `scenario` domain of the metadata, which the core of OTIO carries and never reads.
 *
 * `clipFade` is extended rather than standard, and it is the one interchange loss worth naming:
 * OTIO's `Transition` sits BETWEEN two items and consumes media from both, which a fade held by
 * a clip does not. Writing one as the other would change the cut in the standard part.
 */
const OPEN_TIMELINE: FormatCapability = {
  domain: 'montage',
  interchange: [
    'tracks',
    'trackName',
    'trackOrder',
    'clipPlacement',
    'clipTrim',
    'clipSpeed',
    'mediaLink',
    'trackAudible',
  ],
  extended: [
    'clipFade',
    'clipGain',
    'clipLink',
    'trackSwitches',
    'trackLock',
    'trackHeight',
    'liveScene',
    'exactTime',
    'frameSize',
    'sampleRate',
    'editorState',
  ],
  dropped: [],
}

/**
 * glTF IS the scene document, and nothing of it is lost: what the standard has no field for
 * rides in the scene's `extras` under the studio's own key.
 *
 * The split is what the manual promises — a scene opened elsewhere shows its tree, its cameras
 * and its lights, and is poorer than what this studio draws.
 */
const GLTF_SCENE: FormatCapability = {
  domain: 'scene',
  interchange: ['sceneTree', 'nodeName', 'nodePlacement', 'cameraLens', 'punctualLight'],
  extended: [
    'ambientLight',
    'primitiveShape',
    'nodeMaterial',
    'cameraPath',
    'cameraShot',
    'sceneAnimation',
    'sceneEnvironment',
  ],
  dropped: [],
}

/**
 * MaterialX holds a `standard_surface` fed by `tiledimage` nodes, and it IS the material
 * document. Everything past that rides in the custom attribute the specification reserves for
 * applications — and requires a reader that does not understand it to preserve.
 *
 * `occlusionMap` and `cavityMap` are extended rather than standard because there is nowhere else
 * to put them: the surface shader declares no input for either, so a map another application
 * would honour cannot be written at all. They come back here and nowhere else.
 */
const MATERIAL_X: FormatCapability = {
  domain: 'material',
  interchange: [
    'colourMap',
    'roughnessMap',
    'metalnessMap',
    'normalMap',
    'heightMap',
    'emissiveMap',
    'baseTint',
    'uvTiling',
    'normalScale',
    'heightScale',
    'emissiveStrength',
  ],
  extended: [
    'occlusionMap',
    'cavityMap',
    'valueRanges',
    'normalGreenFlip',
    // `tiledimage` carries `uvtiling` and `uvoffset` and no rotation at all — checked against
    // `MaterialX.StandardNodes.md`. The studio's own turn of the map has no standard slot.
    'uvRotation',
    'channelOrigin',
    'previewState',
  ],
  dropped: [],
}

const CAPABILITY_BY_FORMAT: Record<WritableFormat, FormatCapability> = {
  png: FLAT,
  jpeg: FLAT,
  webp: FLAT,
  ora: OPEN_RASTER,
  otio: OPEN_TIMELINE,
  gltf: GLTF_SCENE,
  mtlx: MATERIAL_X,
}

export const capabilityOf = (format: WritableFormat): FormatCapability =>
  CAPABILITY_BY_FORMAT[format]

const FORMAT_BY_EXTENSION: Record<string, WritableFormat> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
  '.ora': 'ora',
  '.otio': 'otio',
  // `.gltf` only: a `.glb` is what **Exporter** writes of a selection, never a document the
  // studio saves back over.
  '.gltf': 'gltf',
  '.mtlx': 'mtlx',
}

/**
 * Which format a file name says it is, or `null` for one this table does not write.
 *
 * `null` is not « no loss »: it is « no answer », and a caller has to tell the two apart — a
 * `.tif` the studio cannot write is not a container that holds everything.
 */
export function formatOfFile(fileName: string): WritableFormat | null {
  return FORMAT_BY_EXTENSION[extensionOf(fileName).toLowerCase()] ?? null
}

/**
 * What writing `format` would destroy of a document holding `traits` — the question ⌘S asks
 * before it writes over anything. Empty is the licence to overwrite.
 *
 * Read as « what this format does NOT carry » rather than off `dropped`, so a trait of another
 * domain — a layer against an `.otio` — is reported lost instead of silently unclassed.
 *
 * The order given is the order returned: what a document holds is listed the same way twice
 * running, so a message about it does not reshuffle between two saves.
 */
export function lossesFor(
  traits: readonly CapabilityTrait[],
  format: WritableFormat,
): CapabilityTrait[] {
  const { interchange, extended } = capabilityOf(format)
  return traits.filter(trait => !interchange.includes(trait) && !extended.includes(trait))
}

/**
 * What another application would not see is `dropped` PLUS `extended`, and no function computes
 * it yet: nothing shows that answer to anyone. The split is kept in the table rather than folded
 * away because it is what stops « no loss » from being read as « a whole round trip through
 * Krita » — the day a surface says so, the data is already classed.
 */
