import { hasSound, mediaDuration, type Asset } from '@shared/domain/asset'
import { newId } from '@/helpers/ids'
import {
  makeClip,
  playsThrough,
  snapToFrame,
  trackById,
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

/** Which kind of track an asset belongs on. A sound is the only one that is not a picture. */
function kindForAsset(asset: Asset | null): TrackKind {
  return asset?.type === 'audio' ? 'audio' : 'video'
}

/**
 * Whether a drop would be seen or heard on this track. Locked and silenced alike are skipped —
 * landing on either looks exactly like an add that did nothing.
 */
function takes(state: SequenceState, track: Track, kind: TrackKind): boolean {
  return track.kind === kind && !track.locked && playsThrough(state, track)
}

/** The first track of a kind that would take the drop. */
function landingTrack(state: SequenceState, kind: TrackKind): Track | null {
  return state.tracks.find(track => takes(state, track, kind)) ?? null
}

/**
 * Where an asset lands when nobody pointed at a track: sound on a sound track, everything else
 * on a picture track. Locked and silenced tracks are skipped — dropping onto one would look
 * like the add did nothing.
 *
 * Null rather than any track at all when the sequence holds none of that kind: a sound laid on
 * a picture track is painted by the monitor and heard by nobody, which is worse than a refusal.
 */
export function trackForAsset(state: SequenceState, asset: Asset | null): Track | null {
  return landingTrack(state, kindForAsset(asset))
}

/** One clip and the track it goes on. A take that carries a sound yields two of these. */
export type ClipPlacement = { trackId: string; clip: Clip }

/**
 * What laying an asset down comes to: one clip, or the two of a take that carries a sound —
 * the picture on the track that was aimed at, the sound on the first audio track, both tied by
 * a `linkId` so that no later edit can drift one against the other.
 *
 * `trackId` is what the pointer landed on, and it is honoured only when its kind matches the
 * asset: a rush dropped on a sound track otherwise laid a picture where nothing paints it.
 */
export function placementsForAsset(
  state: SequenceState,
  asset: Asset | null,
  assetId: string,
  start: Us,
  trackId?: string,
): ClipPlacement[] {
  const kind = kindForAsset(asset)
  const aimed = trackId ? trackById(state, trackId) : null
  // The same rule for the track that was aimed at as for the one picked for it: a muted track
  // accepted under the pointer and skipped otherwise is two rules for one question.
  const target = aimed && takes(state, aimed, kind) ? aimed : landingTrack(state, kind)
  if (!target) return []

  const clip = clipForAsset(assetId, asset, start, state.settings)
  const sound = kind === 'video' && hasSound(asset) ? landingTrack(state, 'audio') : null
  if (!sound) return [{ trackId: target.id, clip }]

  const linkId = newId()
  return [
    { trackId: target.id, clip: { ...clip, linkId } },
    { trackId: sound.id, clip: { ...clip, id: newId(), linkId } },
  ]
}
