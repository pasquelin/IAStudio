import type { TrackProperty } from '@shared/domain/animation'

/** Reads one bundle line. The window's `t`, or anything that answers a key with a sentence. */
export type SpeaksBundle = (key: string) => string

/** Composed once, so a channel opened from outside reads like one opened by the band's diamond. */
export function channelNames(speaks: SpeaksBundle, subject: string): Record<TrackProperty, string> {
  return {
    position: `${subject} · ${speaks('animation.position')}`,
    rotation: `${subject} · ${speaks('animation.rotation')}`,
    scale: `${subject} · ${speaks('animation.scale')}`,
    fov: `${subject} · ${speaks('animation.fov')}`,
    // Never composed from here in practice: a composition channel is named after the effect
    // INSTANCE and the parameter it drives, which only the composition panel knows. The entry
    // exists so the table stays exhaustive over the union.
    post: `${subject} · ${speaks('postfx.title')}`,
  }
}
