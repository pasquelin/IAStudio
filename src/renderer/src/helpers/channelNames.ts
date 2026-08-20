import type { TrackProperty } from '@shared/domain/animation'

/** Reads one bundle line. The window's `t`, or anything that answers a key with a sentence. */
export type SpeaksBundle = (key: string) => string

/**
 * What each channel of a subject is called, composed once so a channel opened from outside the
 * window is named exactly like one opened by the band's own diamond.
 */
export function channelNames(speaks: SpeaksBundle, subject: string): Record<TrackProperty, string> {
  return {
    position: `${subject} · ${speaks('animation.position')}`,
    rotation: `${subject} · ${speaks('animation.rotation')}`,
    scale: `${subject} · ${speaks('animation.scale')}`,
    fov: `${subject} · ${speaks('animation.fov')}`,
  }
}
