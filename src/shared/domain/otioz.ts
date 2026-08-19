/**
 * An OpenTimelineIO bundle: the cut and the media it points at, in one file.
 *
 * The layout is measured against a bundle written by the reference implementation, byte by byte
 * — `version.txt` and `content.otio` at the root, the media under `media/`, and every clip's
 * `target_url` rewritten to a bare relative path. What the studio writes has to be read by the
 * same adapters, so none of it is a choice.
 *
 * No `fs` and no zip here, only the arithmetic: which entry each medium takes, and what the
 * timeline says once they moved. The writing side pairs it with the bytes.
 */

import { extensionOf, stemOf } from './fileName'
import type { OtioTimeline, OtioTrack, OtioTrackItem } from './otio'

/** The exact contents of `version.txt`, with no trailing newline — read off a reference bundle. */
export const OTIOZ_VERSION = '1.0.0'

export const OTIOZ_VERSION_PATH = 'version.txt'
export const OTIOZ_CONTENT_PATH = 'content.otio'
export const OTIOZ_MEDIA_FOLDER = 'media'

/**
 * Whether a name is an entry this bundle would write — `media/` and one plain segment.
 *
 * Checked on the WRITING side, where the names arrive from the sandboxed one: an entry is a path
 * inside an archive, and `media/../../.bashrc` makes a zip-slip file. Emitting one would be worse
 * than opening one, the studio being what hands it to somebody else.
 */
export function isBundleEntry(entry: string): boolean {
  const name = entry.startsWith(`${OTIOZ_MEDIA_FOLDER}/`)
    ? entry.slice(OTIOZ_MEDIA_FOLDER.length + 1)
    : ''

  if (name === '' || name === '.' || name === '..') return false
  // Spelled by code point rather than as a range inside a regex: a control character written into
  // a source does not survive being edited, and the guard would quietly stop covering them.
  return ![...name].some(letter => letter === '/' || letter === '\\' || letter.charCodeAt(0) < 32)
}

/** One medium on its way into the bundle: where it is read from, and the entry it becomes. */
export type BundledMedium = {
  /** As the timeline named it — a `file://` URL, which only the writing side can open. */
  source: string
  /** `media/<name>`, the relative path the rewritten `target_url` points at. */
  entry: string
}

export type OtioBundle = {
  /** The timeline as it goes into `content.otio`: the same cut, pointing inside the bundle. */
  timeline: OtioTimeline
  /** Each source once, in the order the cut first names it. */
  media: readonly BundledMedium[]
}

/**
 * The last segment of a URL, decoded. `%20` is a space on disk, and an entry that kept the escape
 * would name a file nobody has.
 */
function fileNameOf(url: string): string {
  const path = url.split('?')[0]?.split('#')[0] ?? url
  const last = path.split('/').pop() ?? ''

  try {
    return decodeURIComponent(last)
  } catch {
    // A stray `%` is not an escape, and `decodeURIComponent` throws on it rather than leaving it.
    return last
  }
}

/**
 * A name no other medium took, keeping the extension where a reader looks for it: two media of
 * different folders can share a base name, and `plan.mp4` twice would put one file's pixels under
 * the other's clip. Suffixed BEFORE the dot — `plan-2.mp4` — because an importer reads the format
 * off the extension, and `plan.mp4-2` has none.
 */
function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name

  let index = 2
  while (taken.has(`${stemOf(name)}-${index}${extensionOf(name)}`)) index += 1
  return `${stemOf(name)}-${index}${extensionOf(name)}`
}

function itemInBundle(item: OtioTrackItem, entryOf: (source: string) => string): OtioTrackItem {
  if (item.OTIO_SCHEMA !== 'Clip.1') return item

  const reference = item.media_reference
  // A live scene has no file, and `MissingReference` is how the cut says so. Nothing to carry.
  if (reference.OTIO_SCHEMA !== 'ExternalReference.1') return item

  return {
    ...item,
    media_reference: { ...reference, target_url: entryOf(reference.target_url) },
  }
}

function trackInBundle(track: OtioTrack, entryOf: (source: string) => string): OtioTrack {
  return { ...track, children: track.children.map(item => itemInBundle(item, entryOf)) }
}

/**
 * The timeline as it goes into a bundle, and the media to pack beside it.
 *
 * Every source keeps ONE entry however many clips name it: a rush cut into six pieces is one file
 * in the bundle, and packing it six times is six times the bytes for the same picture.
 */
export function bundleOf(timeline: OtioTimeline): OtioBundle {
  const entryBySource = new Map<string, string>()
  const taken = new Set<string>()

  const entryOf = (source: string): string => {
    const known = entryBySource.get(source)
    if (known) return known

    // `safeName` first: a url can name anything, and what comes out has to be one plain segment
    // — `isBundleEntry` is what the writing side then holds it to.
    const name = freeName(safeName(fileNameOf(source)), taken)
    taken.add(name)

    const entry = `${OTIOZ_MEDIA_FOLDER}/${name}`
    entryBySource.set(source, entry)
    return entry
  }

  const tracks = timeline.tracks.children.map(track => trackInBundle(track, entryOf))
  const media = [...entryBySource].map(([source, entry]) => ({ source, entry }))

  return { timeline: { ...timeline, tracks: { ...timeline.tracks, children: tracks } }, media }
}

/** One plain segment, whatever the url held. Anything a path or an archive reads is replaced. */
function safeName(name: string): string {
  const plain = [...name]
    .map(letter => (letter === '/' || letter === '\\' || letter.charCodeAt(0) < 32 ? '-' : letter))
    .join('')

  return plain === '' || plain === '.' || plain === '..' ? 'media' : plain
}
