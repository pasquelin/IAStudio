import {
  mdiHeadphones,
  mdiLockOpenVariantOutline,
  mdiLockOutline,
  mdiMusicNotePlus,
  mdiVideoPlus,
  mdiVolumeHigh,
  mdiVolumeOff,
} from '@mdi/js'
import type { Track, TrackKind } from '@/engines/timeline/timeline-state'

/** What the add buttons wear. Keyed by kind so a third kind cannot be added without a glyph. */
export const TRACK_KIND_ICONS: Record<TrackKind, string> = {
  video: mdiVideoPlus,
  audio: mdiMusicNotePlus,
}

/** The three switches a track carries. `on` is what the icon and the pressed state both read. */
export type TrackFlag = {
  key: 'muted' | 'solo' | 'locked'
  labelKey: string
  iconFor: (on: boolean) => string
}

/**
 * Declared once and consumed by both surfaces that offer them — the header column beside the
 * strip and the inspector. Two hand-written copies had already drifted into two different
 * controls, so the same switch looked and behaved differently depending on where it was found.
 */
export const TRACK_FLAGS: readonly TrackFlag[] = [
  {
    key: 'muted',
    labelKey: 'timeline.mute',
    iconFor: on => (on ? mdiVolumeOff : mdiVolumeHigh),
  },
  {
    key: 'solo',
    labelKey: 'timeline.solo',
    iconFor: () => mdiHeadphones,
  },
  {
    key: 'locked',
    labelKey: 'timeline.lock',
    iconFor: on => (on ? mdiLockOutline : mdiLockOpenVariantOutline),
  },
]

export function isFlagOn(track: Track, flag: TrackFlag): boolean {
  return track[flag.key]
}
