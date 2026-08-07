import {
  EMPTY_SEQUENCE,
  makeClip,
  makeTrack,
  type Clip,
  type SequenceState,
  type Track,
  type TrackKind,
  type Us,
} from './timeline-state'

/**
 * Sequences for tests. Declared once so a new required field on `Clip` or `Track` breaks in one
 * place rather than in every suite that builds one by hand.
 */
export function clipFixture(id: string, start: Us, duration: Us, extra: Partial<Clip> = {}): Clip {
  return makeClip({ id, assetId: `asset-${id}`, start, duration, ...extra })
}

export function trackFixture(
  id: string,
  kind: TrackKind,
  clips: Clip[] = [],
  extra: Partial<Track> = {},
): Track {
  return makeTrack({ id, kind, index: kind === 'video' ? 1 : 0, clips, ...extra })
}

export function sequenceWith(tracks: Track[]): SequenceState {
  return { ...EMPTY_SEQUENCE, tracks }
}
