/**
 * What the studio can READ from another application, and what it will not rebuild.
 *
 * The twin of `exportRegistry`, and it answers the same question the other way round: an export
 * says what leaving destroys, an import says what arriving never brings. Both are said BEFORE the
 * click, because « it opened but half of it is gone » discovered afterwards is the worse of the
 * two failures.
 */

import {
  capabilityOf,
  type CapabilityDomain,
  type CapabilityTrait,
  type FormatCapability,
  type WritableFormat,
} from './formatCapability'
import type { DocumentKind } from './document'
import { extensionOf } from './fileName'

/** A (section, format read) pair. Named for the section first, as the export targets are. */
export type ImportSourceId = 'montage.otioz'

export const IMPORT_SOURCE_IDS: readonly ImportSourceId[] = ['montage.otioz']

export type ImportSource = {
  domain: CapabilityDomain
  /** What the picker filters on, and what a file has to be named to be offered this reader. */
  extension: string
  /** The document the studio makes of it. */
  kind: DocumentKind
  /**
   * The format the file's CONTENT is, so what the reader rebuilds is derived rather than listed
   * again: the same pair of functions writes it and reads it back, and two lists would disagree
   * the day one gains a trait.
   */
  format: WritableFormat
  /** Whether the media travel inside the file, or are left where the cut points at them. */
  carriesMedia: boolean
}

const SOURCES: Record<ImportSourceId, ImportSource> = {
  'montage.otioz': {
    domain: 'montage',
    extension: '.otioz',
    // A montage, never a take: a take keeps only its audio tracks, so a bundle carrying a picture
    // track would open on a surface that drops it — see `montageHoldsMore`'s own blind spot.
    kind: 'sequence',
    format: 'otio',
    carriesMedia: true,
  },
}

export const importSourceOf = (id: ImportSourceId): ImportSource => SOURCES[id]

/** The reader a file name asks for, or nothing when the studio reads nothing of that shape. */
export function importSourceOfFile(fileName: string): ImportSourceId | null {
  const extension = extensionOf(fileName)
  return IMPORT_SOURCE_IDS.find(id => SOURCES[id].extension === extension) ?? null
}

export const capabilityImportingFrom = (id: ImportSourceId): FormatCapability =>
  capabilityOf(SOURCES[id].format)

/**
 * What a file written by ANOTHER application does not bring.
 *
 * Everything outside `interchange`, and that is the whole point of the split: `extended` is what
 * this studio writes beside the standard part and reads back from its own files — a montage that
 * never passed through here carries none of it, whatever the round trip says.
 */
export function lossesImportingFrom(id: ImportSourceId): CapabilityTrait[] {
  const { interchange, extended, dropped } = capabilityImportingFrom(id)
  return [...extended, ...dropped].filter(trait => !interchange.includes(trait))
}
