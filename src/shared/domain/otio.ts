/**
 * OpenTimelineIO, as this studio writes and reads it.
 *
 * The open format for a cut: plain JSON, every object naming its own schema, read by Resolve and
 * Premiere through adapters. It carries the STRUCTURE of a montage — tracks, their order, where
 * each clip sits, how long it lasts, where it starts inside its source, how fast it plays and
 * what file it draws from. That is the whole of what a `.seq` loses today by existing nowhere
 * else.
 *
 * What the standard has no field for rides under `OTIO_STUDIO_KEY` in `metadata`, which the core
 * of OTIO carries verbatim and never reads. `formatCapability.ts` says which traits fall on which
 * side, and that split is the contract: a fade written here is read back here and is invisible
 * anywhere else.
 *
 * Only the subset this studio writes is modelled. A transition, a marker or a nested stack read
 * from a foreign file is not represented — see `sequenceFromOtio` for what that costs.
 */

/** The extension, and the domain key metadata travels under — the spec asks for a unique one. */
export const OTIO_EXTENSION = '.otio'
export const OTIO_STUDIO_KEY = 'scenario'

/**
 * Which document of the studio a timeline IS, under the studio domain. Read by BOTH processes —
 * the window writes it, the file layer reads it back as the document's id — so it is spelt here
 * rather than on either side, where the two spellings would be free to drift apart in silence.
 */
export const OTIO_DOCUMENT_ID = 'documentId'

/** A time as OTIO holds it: a count of `rate`ths of a second. */
export type OtioRationalTime = { OTIO_SCHEMA: 'RationalTime.1'; rate: number; value: number }

export type OtioTimeRange = {
  OTIO_SCHEMA: 'TimeRange.1'
  start_time: OtioRationalTime
  duration: OtioRationalTime
}

/** Free-form by design: the core of OTIO carries it and never looks inside. */
export type OtioMetadata = Record<string, unknown>

/** A media file on disk. `target_url` is what another application resolves to open it. */
export type OtioExternalReference = {
  OTIO_SCHEMA: 'ExternalReference.1'
  name: string
  metadata: OtioMetadata
  available_range: OtioTimeRange | null
  target_url: string
}

/**
 * A clip whose media is not a file. The honest encoding for a live 3D scene: the cut survives
 * whole elsewhere — right place, right length — and only the picture is missing, which is what
 * `MissingReference` means. Naming a `.scene` in an `ExternalReference` would instead hand
 * another application a file it would try to decode.
 */
export type OtioMissingReference = {
  OTIO_SCHEMA: 'MissingReference.1'
  name: string
  metadata: OtioMetadata
  available_range: null
}

export type OtioMediaReference = OtioExternalReference | OtioMissingReference

/** Playback speed, as the core schema holds it: `time_scalar` of 2 plays twice as fast. */
export type OtioLinearTimeWarp = {
  OTIO_SCHEMA: 'LinearTimeWarp.1'
  name: string
  metadata: OtioMetadata
  effect_name: 'LinearTimeWarp'
  time_scalar: number
}

/**
 * Fields every item of a track shares. `markers` is always empty here — this studio has none —
 * and is written because every object in the specification's own example carries it.
 */
type OtioItem = {
  name: string
  metadata: OtioMetadata
  source_range: OtioTimeRange
  markers: readonly unknown[]
  /** False for a track nothing should reach the output from — a mute, or a solo elsewhere. */
  enabled: boolean
}

export type OtioClip = OtioItem & {
  OTIO_SCHEMA: 'Clip.1'
  effects: readonly OtioLinearTimeWarp[]
  media_reference: OtioMediaReference
}

/** The silence between two clips. An OTIO track is contiguous, so a hole has to be an object. */
export type OtioGap = OtioItem & {
  OTIO_SCHEMA: 'Gap.1'
  effects: readonly unknown[]
}

export type OtioTrackItem = OtioClip | OtioGap

/** `kind` is a free string in the format; these two are the constants every reader knows. */
export type OtioTrackKind = 'Video' | 'Audio'

export type OtioTrack = {
  OTIO_SCHEMA: 'Track.1'
  name: string
  metadata: OtioMetadata
  kind: OtioTrackKind
  children: readonly OtioTrackItem[]
  source_range: null
  effects: readonly unknown[]
  markers: readonly unknown[]
  enabled: boolean
}

/**
 * The root of the tracks. Its children run BOTTOM first: the last one is the layer on top, the
 * opposite of the studio's own array, where the head of the list is what is seen.
 */
export type OtioStack = {
  OTIO_SCHEMA: 'Stack.1'
  name: string
  metadata: OtioMetadata
  children: readonly OtioTrack[]
  source_range: null
  effects: readonly unknown[]
  markers: readonly unknown[]
  enabled: boolean
}

export type OtioTimeline = {
  OTIO_SCHEMA: 'Timeline.1'
  name: string
  metadata: OtioMetadata
  /** The timecode the montage starts on. Zero here: a sequence has no start timecode. */
  global_start_time: OtioRationalTime | null
  tracks: OtioStack
}
