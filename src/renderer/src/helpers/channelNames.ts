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
    post: `${subject} · ${speaks('postfx.title')}`,
  }
}

/**
 * What a composition channel is called: the effect, then the parameter it drives.
 *
 * Here rather than in the panel that opens it — a name is what the band shows, and one composed
 * inside a click handler is a name no test reads back.
 */
export function postChannelName(speaks: SpeaksBundle, effect: string, param: string): string {
  return `${speaks(`postfx.effect_${effect}`)} · ${speaks(`postfx.param_${param}`)}`
}
