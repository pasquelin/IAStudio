import type { Asset } from '@shared/domain/asset'
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
  type Us,
} from './timeline-state'

/** What an asset still being probed is worth on the timeline, until its real duration lands. */
export const UNPROBED_DURATION: Us = 5_000_000

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
    duration: wholeFrames(asset?.probe?.duration ?? UNPROBED_DURATION, settings),
  })
}

/**
 * Where an asset lands when nobody pointed at a track: sound on a sound track, everything else
 * on a picture track. Locked and silenced tracks are skipped — dropping onto one would look
 * like the add did nothing.
 */
export function trackForAsset(state: SequenceState, asset: Asset | null): Track | null {
  const wanted = asset?.type === 'audio' ? 'audio' : 'video'
  const usable = state.tracks.filter(track => !track.locked && playsThrough(state, track))

  return usable.find(track => track.kind === wanted) ?? usable[0] ?? null
}
