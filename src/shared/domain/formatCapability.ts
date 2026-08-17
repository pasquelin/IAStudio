/**
 * What a file format can hold of an edited document, and what it would drop.
 *
 * The one place answering « can this format carry what this document contains? ». That answer
 * used to be written per kind in prose, and only the image acted on it — by flattening its stack
 * over the very source file it was opened from.
 */

import { extensionOf } from './fileName'

/**
 * A property of an edited document that a format either carries or loses.
 *
 * Picture traits alone today, because the image is the one kind that writes back over a source.
 * A second domain adds its own here rather than beside: the question is the same one.
 */
export type CapabilityTrait =
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

export const CAPABILITY_TRAITS: readonly CapabilityTrait[] = [
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

/** A format the studio can write an edited picture to. */
export type WritableFormat = 'png' | 'jpeg' | 'webp' | 'ora' | 'img'

export const WRITABLE_FORMATS: readonly WritableFormat[] = ['png', 'jpeg', 'webp', 'ora', 'img']

/**
 * Where each trait lands in a given format. The three lists PARTITION the traits — a guard holds
 * it — which is what stops a trait added later from reading as carried when nobody classed it.
 *
 * `interchange` and `extended` is the distinction the whole feature turns on: one says what
 * another application reads, the other what only this studio reads back. Saying « no loss »
 * without that split would promise a round trip through Krita that no format can keep.
 */
export type FormatCapability = {
  /** Standard in this format, so another application reads it. */
  interchange: readonly CapabilityTrait[]
  /** Carried as studio data alongside the standard part: read back here, invisible elsewhere. */
  extended: readonly CapabilityTrait[]
  /** Not carried at all. Writing this format destroys it. */
  dropped: readonly CapabilityTrait[]
}

/** Nothing survives a flatten, so the three flat formats share one entry. */
const FLAT: FormatCapability = {
  interchange: [],
  extended: [],
  dropped: CAPABILITY_TRAITS,
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

/** The studio's own document: it loses nothing, and no one else reads it. */
const STUDIO: FormatCapability = {
  interchange: [],
  extended: CAPABILITY_TRAITS,
  dropped: [],
}

const CAPABILITY_BY_FORMAT: Record<WritableFormat, FormatCapability> = {
  png: FLAT,
  jpeg: FLAT,
  webp: FLAT,
  ora: OPEN_RASTER,
  img: STUDIO,
}

export const capabilityOf = (format: WritableFormat): FormatCapability =>
  CAPABILITY_BY_FORMAT[format]

const FORMAT_BY_EXTENSION: Record<string, WritableFormat> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
  '.ora': 'ora',
  '.img': 'img',
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
 * The order given is the order returned: what a document holds is listed the same way twice
 * running, so a message about it does not reshuffle between two saves.
 */
export function lossesFor(
  traits: readonly CapabilityTrait[],
  format: WritableFormat,
): CapabilityTrait[] {
  return traits.filter(trait => capabilityOf(format).dropped.includes(trait))
}

/**
 * What another application would not see — the destroyed AND the merely extended.
 *
 * A second question, never a stricter version of the first: a mask kept as studio data is not a
 * loss, but promising it to someone opening the file in Krita would be a lie.
 */
export function unseenBy(
  traits: readonly CapabilityTrait[],
  format: WritableFormat,
): CapabilityTrait[] {
  return traits.filter(trait => !capabilityOf(format).interchange.includes(trait))
}
