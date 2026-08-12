import { mediaDuration, type Asset } from '@shared/domain/asset'
import { newId } from '@/helpers/ids'
import {
  makeClip,
  playsThrough,
  snapToFrame,
  wholeFrames,
  type Clip,
  type SequenceSettings,
  type SequenceState,
  type Track,
  type TrackKind,
  type Us,
} from './timeline-state'

/** What a media with no length of its own is worth on the strip — a still, or an unprobed asset. */
export const TIMELESS_DURATION: Us = 5_000_000

/**
 * The clip an asset becomes. Shared by the drop on the strip and by the shelf's own add
 * action: two ways in that must agree on the length, the grid and the defaults.
 */
export function clipForAsset(
  assetId: string,
  asset: Asset | null,
  start: Us,
  settings: SequenceSettings,
): Clip {
  return makeClip({
    id: newId(),
    assetId,
    start: snapToFrame(start, settings),
    // A whole number of frames, so the clip's tail stays snappable — see `wholeFrames`.
    duration: wholeFrames(mediaDuration(asset) ?? TIMELESS_DURATION, settings),
  })
}

/**
 * Which kind of track an asset belongs on: sound on a sound track, everything else on a picture
 * track. An unknown asset counts as picture — a strip that shows nothing is read as a missing
 * media, where one that plays nothing is read as a broken studio.
 */
export function trackKindFor(asset: Asset | null): TrackKind {
  return asset?.type === 'audio' ? 'audio' : 'video'
}

/**
 * Where an asset lands when nobody pointed at a track. Locked and silenced tracks are skipped —
 * dropping onto one would look like the add did nothing.
 */
export function trackForAsset(state: SequenceState, asset: Asset | null): Track | null {
  const wanted = trackKindFor(asset)
  const usable = state.tracks.filter(track => !track.locked && playsThrough(state, track))

  return usable.find(track => track.kind === wanted) ?? usable[0] ?? null
}
