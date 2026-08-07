/**
 * A sequence, as plain data. It holds no decoder and no Pixi object: an engine is rebuilt from
 * its serialized state, never from its DOM, and jsdom has neither WebCodecs nor WebGL.
 */

/** Timeline time, in microseconds. Never float seconds: drift accumulates over a long edit. */
export type Us = number

export type SequenceSettings = {
  width: number
  height: number
  fps: number
  sampleRate: number
}

export type TrackKind = 'video' | 'audio'

export type Clip = {
  id: string
  /** Resolved against the project catalogue, never against a file path. */
  assetId: string
  start: Us
  duration: Us
  /** Entry point inside the source media. */
  inPoint: Us
  speed: number
}

export type Track = {
  id: string
  kind: TrackKind
  /** Compositing order: higher wins. */
  index: number
  muted: boolean
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

const SECOND: Us = 1_000_000

export const DEFAULT_SETTINGS: SequenceSettings = {
  width: 1920,
  height: 1080,
  fps: 25,
  sampleRate: 48_000,
}

/** A new sequence opens on one video and one audio track: a timeline you cannot drop on is a bug. */
export const EMPTY_SEQUENCE: SequenceState = {
  settings: DEFAULT_SETTINGS,
  tracks: [
    { id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips: [] },
    { id: 'A1', kind: 'audio', index: 0, muted: false, locked: false, clips: [] },
  ],
  selectedId: null,
  playhead: 0,
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
      clips.push({ ...existing, duration: clip.start - existing.start })
    }

    // Tail survives: it starts later in the source, so its in point moves with it.
    if (existingEnd > end) {
      clips.push({
        ...existing,
        id: existing.start < clip.start ? tailId : existing.id,
        start: end,
        duration: existingEnd - end,
        inPoint: existing.inPoint + (end - existing.start),
      })
    }
  }

  clips.push(clip)
  return { ...track, clips: clips.sort((left, right) => left.start - right.start) }
}

export function serializeSequence(state: SequenceState): string {
  return JSON.stringify(state)
}

/** Unreadable input yields a fresh sequence: a blank timeline beats an uncaught throw. */
export function deserializeSequence(raw: string): SequenceState {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_SEQUENCE

    const { settings, tracks, selectedId, playhead } = parsed as Partial<SequenceState>
    if (!Array.isArray(tracks) || tracks.length === 0) return EMPTY_SEQUENCE

    return {
      settings: settings ?? DEFAULT_SETTINGS,
      tracks,
      selectedId: typeof selectedId === 'string' ? selectedId : null,
      playhead: typeof playhead === 'number' ? playhead : 0,
    }
  } catch {
    return EMPTY_SEQUENCE
  }
}
