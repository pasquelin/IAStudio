/**
 * A sequence, as plain data. It holds no decoder and no Pixi object: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has neither WebCodecs nor WebGL.
 */
import { isRecord, readBoolean, readNumber, readPositive, readString } from '@shared/guards'
import { clamp } from '@shared/numeric'

/** Timeline time, in microseconds. Never float seconds: drift accumulates over a long edit. */
export type Us = number

export type SequenceSettings = {
  width: number
  height: number
  fps: number
  sampleRate: number
}

export type TrackKind = 'video' | 'audio'

/** Both of them, for the same reason as `LAYER_KINDS`: the inspector names a track by its kind. */
export const TRACK_KINDS: readonly TrackKind[] = ['video', 'audio']

/** Which end of a clip an edit works on — a trim, a fade, a snap candidate. */
export type ClipEdge = 'in' | 'out'

export const CLIP_EDGES: readonly ClipEdge[] = ['in', 'out']

export type Clip = {
  id: string
  /** Resolved against the project catalogue, never against a file path. */
  assetId: string
  start: Us
  duration: Us
  /** Entry point inside the source media. */
  inPoint: Us
  speed: number
  /** Ramp lengths measured from each end of the clip. */
  fadeIn: Us
  fadeOut: Us
  /** Decibels, audio only. Zero leaves the clip as it was recorded. */
  gain: number
}

export type Track = {
  id: string
  kind: TrackKind
  /** Shown in the header column. The id identifies, the name is what the user renames. */
  name: string
  /** Compositing order: higher wins. */
  index: number
  /** Row height in CSS pixels, dragged from the header. */
  height: number
  muted: boolean
  solo: boolean
  locked: boolean
  /** Sorted by `start`, never overlapping — `insertClip` is what guarantees it. */
  clips: Clip[]
}

export type SequenceState = {
  settings: SequenceSettings
  tracks: Track[]
  selectedId: string | null
  playhead: Us
}

/** One second, in the unit the whole studio counts time in. */
export const SECOND: Us = 1_000_000

export const DEFAULT_SETTINGS: SequenceSettings = {
  width: 1920,
  height: 1080,
  fps: 25,
  sampleRate: 48_000,
}

export const DEFAULT_TRACK_HEIGHT = 56
/** Below this a waveform is unreadable; above it one track fills the strip. */
export const MIN_TRACK_HEIGHT = 28
export const MAX_TRACK_HEIGHT = 200

export function clampTrackHeight(height: number): number {
  return clamp(Math.round(height), MIN_TRACK_HEIGHT, MAX_TRACK_HEIGHT)
}

/** Below -60 dB nothing is audible, and above +12 dB generated audio only clips. */
export const MIN_GAIN_DB = -60
export const MAX_GAIN_DB = 12

export function clampGain(gain: number): number {
  return clamp(gain, MIN_GAIN_DB, MAX_GAIN_DB)
}

/** The range every media element agrees to resample without dropping to silence. */
export const MIN_SPEED = 0.25
export const MAX_SPEED = 4

export function clampSpeed(speed: number): number {
  return clamp(speed, MIN_SPEED, MAX_SPEED)
}

export type ClipInit = Pick<Clip, 'id' | 'assetId' | 'start' | 'duration'> & Partial<Clip>

/**
 * The one place a clip is born. Written once so a dropped clip, a pasted clip and a clip read
 * back from disk cannot disagree on what an untouched fade or an untouched gain is.
 */
export function makeClip(init: ClipInit): Clip {
  return { inPoint: 0, speed: 1, fadeIn: 0, fadeOut: 0, gain: 0, ...init }
}

export type TrackInit = Pick<Track, 'id' | 'kind' | 'index'> & Partial<Track>

export function makeTrack(init: TrackInit): Track {
  return {
    name: init.id,
    height: DEFAULT_TRACK_HEIGHT,
    muted: false,
    solo: false,
    locked: false,
    clips: [],
    ...init,
  }
}

/** A new sequence opens on one video and one audio track: a timeline you cannot drop on is a bug. */
export const EMPTY_SEQUENCE: SequenceState = {
  settings: DEFAULT_SETTINGS,
  tracks: [
    makeTrack({ id: 'V1', kind: 'video', index: 1 }),
    makeTrack({ id: 'A1', kind: 'audio', index: 0 }),
  ],
  selectedId: null,
  playhead: 0,
}

/** The letter a kind's tracks are named after, on the pattern `EMPTY_SEQUENCE` opens with. */
const TRACK_PREFIX: Record<TrackKind, string> = { video: 'V', audio: 'A' }

/**
 * The next free name of a kind — V1, V2, A1… — rather than a uuid: `makeTrack` names a track by
 * its id, and a header column reading `track_9f3c…` shows a name nobody typed. Renaming is a
 * command of its own, so this only has to be free, not final.
 */
export function nextTrackId(state: SequenceState, kind: TrackKind): string {
  const taken = new Set(state.tracks.map(track => track.id))
  const prefix = TRACK_PREFIX[kind]

  for (let n = 1; ; n += 1) {
    const id = `${prefix}${n}`
    if (!taken.has(id)) return id
  }
}

/**
 * Depth read back from position: the first row of the column is drawn last, so it is the one
 * seen on top. `videoTracksByDepth` sorts on `index` while the header column reads the array —
 * without this the two disagree the moment a track is added, removed or moved.
 */
export function reindexTracks(tracks: readonly Track[]): Track[] {
  return tracks.map((track, position) => ({ ...track, index: tracks.length - 1 - position }))
}

export function frameDuration(settings: SequenceSettings): Us {
  return Math.round(SECOND / settings.fps)
}

export function snapToFrame(time: Us, settings: SequenceSettings): Us {
  const frame = frameDuration(settings)
  return Math.max(0, Math.round(time / frame) * frame)
}

/**
 * A clip lasts a whole number of frames. Half a frame cannot be shown, and a duration off the
 * grid puts the clip's tail off it too — which no neighbour can then be butt-joined against.
 */
export function wholeFrames(duration: Us, settings: SequenceSettings): Us {
  const frame = frameDuration(settings)
  return Math.max(frame, Math.round(duration / frame) * frame)
}

/**
 * A clip born from a cut needs an id of its own. Deriving it from the one it was cut out of
 * collides as soon as that clip is cut a second time, and two clips sharing an id break every
 * lookup, starting with selection.
 */
export function newClipId(): string {
  return `clip_${crypto.randomUUID()}`
}

export function clipEnd(clip: Clip): Us {
  return clip.start + clip.duration
}

/** Timeline time → time inside the source, through the in point and the speed. */
export function sourceTimeAt(clip: Clip, time: Us): Us {
  return clip.inPoint + Math.round((time - clip.start) * clip.speed)
}

/**
 * The part of a clip that starts at `time`: it begins that much later in the source. Three edits
 * need this and must agree — a trim of the in point, a split, and the tail an insertion cuts
 * loose — because a source offset off by a hair drifts the picture against the sound.
 */
export function clipFrom(clip: Clip, time: Us): Clip {
  return {
    ...clip,
    start: time,
    duration: clipEnd(clip) - time,
    inPoint: sourceTimeAt(clip, time),
  }
}

/**
 * Fades that overlap would raise the level in the middle instead of lowering it at both ends.
 * Trimming a clip shorter than its own ramps is the ordinary way to get there.
 */
export function clampFades(clip: Clip): Clip {
  const fadeIn = Math.max(0, Math.min(clip.fadeIn, clip.duration))
  const fadeOut = Math.max(0, Math.min(clip.fadeOut, clip.duration - fadeIn))
  return fadeIn === clip.fadeIn && fadeOut === clip.fadeOut ? clip : { ...clip, fadeIn, fadeOut }
}

/**
 * Whether a track reaches the output. One track soloed anywhere silences every track that is
 * not — that is what solo means, and reading `muted` alone would let them all through.
 */
export function playsThrough(state: SequenceState, track: Track): boolean {
  if (track.muted) return false
  return state.tracks.some(candidate => candidate.solo) ? track.solo : true
}

/** Where the sequence stops: the last frame any track still shows something on. */
export function sequenceDuration(state: SequenceState): Us {
  let end: Us = 0
  for (const track of state.tracks) {
    for (const clip of track.clips) end = Math.max(end, clipEnd(clip))
  }
  return end
}

export function trackById(state: SequenceState, id: string): Track | null {
  return state.tracks.find(track => track.id === id) ?? null
}

/** A locked track refuses every edit, whether it is a command applying or a clip being dropped. */
export function editableTrack(state: SequenceState, id: string): Track | null {
  const track = trackById(state, id)
  return track && !track.locked ? track : null
}

export function trackOfClip(state: SequenceState, clipId: string): Track | null {
  return state.tracks.find(track => track.clips.some(clip => clip.id === clipId)) ?? null
}

export function clipById(state: SequenceState, id: string): Clip | null {
  for (const track of state.tracks) {
    const found = track.clips.find(clip => clip.id === id)
    if (found) return found
  }
  return null
}

/**
 * The clip a key press acts on. The selection wins while the playhead is inside it — that is
 * the one the user is looking at — and otherwise whatever the playhead crosses, so a blade
 * works without selecting first.
 */
export function clipUnderPlayhead(state: SequenceState): Clip | null {
  const spans = (clip: Clip): boolean =>
    state.playhead > clip.start && state.playhead < clipEnd(clip)

  const selected = state.selectedId ? clipById(state, state.selectedId) : null
  if (selected && spans(selected)) return selected

  for (const track of state.tracks) {
    if (track.locked) continue
    const found = track.clips.find(spans)
    if (found) return found
  }
  return null
}

/** Rewrites one track in place. The single spot that knows how to keep the others untouched. */
export function updateTrack(
  state: SequenceState,
  trackId: string,
  change: (track: Track) => Track,
): SequenceState {
  return {
    ...state,
    tracks: state.tracks.map(track => (track.id === trackId ? change(track) : track)),
  }
}

/** Rewrites one clip wherever it sits. Fades are re-clamped, so no caller has to remember to. */
export function updateClip(
  state: SequenceState,
  clipId: string,
  change: (clip: Clip) => Clip,
): SequenceState {
  return {
    ...state,
    tracks: state.tracks.map(track =>
      track.clips.some(clip => clip.id === clipId)
        ? {
            ...track,
            clips: track.clips.map(clip => (clip.id === clipId ? clampFades(change(clip)) : clip)),
          }
        : track,
    ),
  }
}

/**
 * Overwrite insertion: the dropped clip wins, and what it covers is trimmed, split or dropped.
 * This is what keeps "sorted by start, never overlapping" true without asking callers to care.
 *
 * `tailId` names the clip an insertion landing mid-neighbour cuts loose. It is an input rather
 * than something minted here: a reducer that invents an id is no longer a pure function of its
 * state, and this one runs on every pointer move of a drag.
 */
export function insertClip(track: Track, clip: Clip, tailId: string): Track {
  const end = clipEnd(clip)
  const clips: Clip[] = []

  for (const existing of track.clips) {
    const existingEnd = clipEnd(existing)
    if (existingEnd <= clip.start || existing.start >= end) {
      clips.push(existing)
      continue
    }

    // Head survives: the part before the newcomer keeps its own in point.
    if (existing.start < clip.start) {
      clips.push(clampFades({ ...existing, duration: clip.start - existing.start }))
    }

    // Tail survives: it starts later in the source, so its in point moves with it.
    if (existingEnd > end) {
      clips.push(
        clampFades({
          ...clipFrom(existing, end),
          id: existing.start < clip.start ? tailId : existing.id,
        }),
      )
    }
  }

  clips.push(clampFades(clip))
  return { ...track, clips: clips.sort((left, right) => left.start - right.start) }
}

function readClip(raw: unknown): Clip | null {
  if (!isRecord(raw)) return null

  const id = readString(raw, 'id', '')
  const assetId = readString(raw, 'assetId', '')
  const duration = readNumber(raw, 'duration', 0)
  // A clip with no identity, no source or no length cannot be drawn, selected or played.
  if (!id || !assetId || duration <= 0) return null

  return clampFades(
    makeClip({
      id,
      assetId,
      duration,
      start: readPositive(raw, 'start', 0),
      inPoint: readPositive(raw, 'inPoint', 0),
      speed: readNumber(raw, 'speed', 1) || 1,
      fadeIn: readPositive(raw, 'fadeIn', 0),
      fadeOut: readPositive(raw, 'fadeOut', 0),
      gain: readNumber(raw, 'gain', 0),
    }),
  )
}

function readTrack(raw: unknown, row: number): Track | null {
  if (!isRecord(raw)) return null

  const id = readString(raw, 'id', '')
  if (!id) return null

  const clips: Clip[] = []
  if (Array.isArray(raw.clips)) {
    for (const entry of raw.clips) {
      const clip = readClip(entry)
      if (clip) clips.push(clip)
    }
  }

  const track = makeTrack({
    id,
    kind: raw.kind === 'audio' ? 'audio' : 'video',
    index: readNumber(raw, 'index', row),
    name: readString(raw, 'name', id),
    height: clampTrackHeight(readNumber(raw, 'height', DEFAULT_TRACK_HEIGHT)),
    muted: readBoolean(raw, 'muted', false),
    solo: readBoolean(raw, 'solo', false),
    locked: readBoolean(raw, 'locked', false),
  })

  // Reinserted rather than trusted: a file edited by hand, or written by an older version,
  // can hold overlapping clips, and every later edit assumes they do not.
  return clips.reduce((current, clip) => insertClip(current, clip, newClipId()), track)
}

function readSettings(raw: unknown): SequenceSettings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS

  const fps = readNumber(raw, 'fps', DEFAULT_SETTINGS.fps)
  const sampleRate = readNumber(raw, 'sampleRate', DEFAULT_SETTINGS.sampleRate)
  return {
    width: readNumber(raw, 'width', DEFAULT_SETTINGS.width),
    height: readNumber(raw, 'height', DEFAULT_SETTINGS.height),
    // A zero frame rate divides by zero in `frameDuration`, and every snap after it.
    fps: fps > 0 ? fps : DEFAULT_SETTINGS.fps,
    sampleRate: sampleRate > 0 ? sampleRate : DEFAULT_SETTINGS.sampleRate,
  }
}

/**
 * A sequence read back from a file. Takes the parsed value rather than the text, like every
 * other document reader: text that is not JSON at all is a file that failed to read, and the
 * caller must be able to tell that from a file whose shape is merely wrong — the first refuses
 * to be written over, the second opens on an empty timeline.
 */
export function parseSequence(content: unknown): SequenceState {
  if (!isRecord(content) || !Array.isArray(content.tracks)) return EMPTY_SEQUENCE

  const tracks: Track[] = []
  content.tracks.forEach((entry, row) => {
    const track = readTrack(entry, row)
    if (track) tracks.push(track)
  })
  if (tracks.length === 0) return EMPTY_SEQUENCE

  const selectedId = content.selectedId
  return {
    settings: readSettings(content.settings),
    tracks,
    // Dropped when it points at a clip the read discarded: nothing may select nothing.
    selectedId:
      typeof selectedId === 'string' && tracks.some(t => t.clips.some(c => c.id === selectedId))
        ? selectedId
        : null,
    playhead: readPositive(content, 'playhead', 0),
  }
}
