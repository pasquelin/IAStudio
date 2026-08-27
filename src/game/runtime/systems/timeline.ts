// SPDX-License-Identifier: MIT

import type { AnimationTimeline, TimelineMedia, TimelineTransition } from '@shared/domain/animation'
import type { Ref } from '@shared/domain/ref'
import type { AudioVoice } from '../../ports/audioPort'
import { sayCustom } from '../sayCustom'
import type { System, World } from '../world'

export type TimelineSystemOptions = {
  /** The scene's own timeline. Absent rows play nothing — a scene that carries none is silent. */
  timeline: AnimationTimeline
  /** How the host spells an asset of the catalogue — the studio's reference, or an export's. */
  assetRef: (assetId: string) => Ref
}

/**
 * What a timeline DOES while a game runs: its events on the bus, its sounds, its veil.
 *
 * 🛑 NOT played here, and read back all the same: `video`, which no port offers a surface for,
 * the `scene` of a transition, which is the multi-scene lot, and the fades of a sound.
 */
export function createTimelineSystem(options: TimelineSystemOptions): System {
  // Resolved ONCE: a `?? []` in a fixed update is a fresh array 240 times a second, for every
  // scene written before this lot — which is all of them.
  const events = options.timeline.events ?? []
  const audio = options.timeline.audio ?? []
  const transitions = (options.timeline.transitions ?? []).filter(playable)
  const fired = new Set<string>()
  const playing = new Map<string, AudioVoice>()

  return {
    name: 'timeline',
    reads: [],
    writes: [],

    fixedUpdate: (world: World) => {
      // 🛑 The world's clock, never one of its own: a timeline that counted separately would
      // drift from the physics at the first late frame. It also never goes backwards — a STOP
      // builds a new world and a new system — so nothing here has to be undone.
      const now = world.time.elapsed * MICROSECONDS_A_SECOND

      for (const event of events) {
        // 🛑 `at > now` is FALSE for a `NaN`, so the row would fire on the first step. What is
        // not a finite instant is not an instant, and it never comes due.
        if (!Number.isFinite(event.at) || event.at > now || fired.has(event.id)) continue
        fired.add(event.id)
        sayCustom(world, event.name, event.entity, event.payload)
      }

      for (const sound of audio) {
        const on = within(sound, now)
        if (on && !playing.has(sound.id)) {
          const voice = world.ports.audio.play(options.assetRef(sound.assetId), {
            volume: sound.gain ?? 1,
            loop: sound.loop === true,
          })
          if (voice) playing.set(sound.id, voice)
        } else if (!on && playing.has(sound.id)) {
          playing.get(sound.id)?.stop()
          playing.delete(sound.id)
        }
      }

      world.ports.render.veil(veilAt(transitions, now))
    },
  }
}

/** A timeline counts in microseconds; the world counts seconds. */
const MICROSECONDS_A_SECOND = 1_000_000

const within = (media: TimelineMedia, now: number): boolean =>
  now >= media.start && now < media.start + media.duration

/** A `cut` is a change, not a fade: it veils nothing. An instant that is not one veils nothing. */
const playable = (transition: TimelineTransition): boolean =>
  transition.kind !== 'cut' &&
  Number.isFinite(transition.at) &&
  Number.isFinite(transition.duration) &&
  transition.duration > 0

/**
 * 🛑 ONE transition at a time — the LAST of the list that is running.
 *
 * The same rule a montage settles an overlap by, and the one `activeShotAt` already applies to
 * the camera shots: the line drawn highest wins, read off the order of the list. Combining two
 * that overlap made the picture go dark, open back up between them, and go dark again.
 */
function veilAt(transitions: readonly TimelineTransition[], now: number): number {
  for (let at = transitions.length - 1; at >= 0; at--) {
    const transition = transitions[at]
    if (!transition) continue

    const through = (now - transition.at) / transition.duration
    if (through < 0 || through > 1) continue
    // Full at its halfway mark, back down after: one row is one whole transition.
    return through <= 0.5 ? through * 2 : (1 - through) * 2
  }
  return 0
}
