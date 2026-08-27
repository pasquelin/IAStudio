// SPDX-License-Identifier: MIT

import type { AnimationTimeline, TimelineMedia } from '@shared/domain/animation'
import type { Ref } from '@shared/domain/ref'
import type { AudioVoice } from '../../ports/audioPort'
import type { System, World } from '../world'

export type TimelineSystemOptions = {
  /** The scene's own timeline. Absent rows play nothing — a scene that carries none is silent. */
  timeline: AnimationTimeline
  /** How the host spells an asset of the catalogue — the studio's reference, or an export's. */
  assetRef: (assetId: string) => Ref
}

/**
 * What a timeline DOES while a game runs: its events on the bus, its sounds playing, its veil.
 *
 * 🛑 The playhead is the WORLD's clock, never a value of its own: a timeline with a head of its
 * own would drift from the physics the moment a frame was late, and a cinematic that drifts from
 * what it cues is a cinematic nobody can cut.
 *
 * 🛑 What is NOT played here, written rather than discovered: `video`, which needs a surface no
 * port offers yet, and the `scene` of a transition, which is the multi-scene lot. Both are READ
 * back from the document and survive a save — see `sceneDocument`.
 */
export function createTimelineSystem(options: TimelineSystemOptions): System {
  const fired = new Set<string>()
  const playing = new Map<string, AudioVoice>()
  let last = -1

  return {
    name: 'timeline',
    reads: [],
    writes: [],

    fixedUpdate: (world: World) => {
      const now = world.time.elapsed * MICROSECONDS
      // Backwards is a game that started again: everything is due once more.
      if (now < last) {
        fired.clear()
        stopAll(playing)
      }
      last = now

      for (const event of options.timeline.events ?? []) {
        if (event.at > now || fired.has(event.id)) continue
        fired.add(event.id)
        world.events.emit({
          name: 'Custom',
          entity: event.entity,
          payload: { ...event.payload, name: event.name },
        })
      }

      for (const sound of options.timeline.audio ?? []) {
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

      world.ports.render.veil(veilAt(options.timeline, now))
    },
  }
}

/** A microsecond is what a timeline counts in; the world counts seconds. */
const MICROSECONDS = 1_000_000

const within = (media: TimelineMedia, now: number): boolean =>
  now >= media.start && now < media.start + media.duration

const stopAll = (playing: Map<string, AudioVoice>): void => {
  for (const voice of playing.values()) voice.stop()
  playing.clear()
}

/**
 * How far the picture is veiled at that instant.
 *
 * A `cut` is instant and veils nothing — it is a change, not a fade. The others rise to full and
 * come back, which is what a transition between two moments looks like from the inside.
 */
function veilAt(timeline: AnimationTimeline, now: number): number {
  let veil = 0
  for (const transition of timeline.transitions ?? []) {
    if (transition.kind === 'cut' || transition.duration <= 0) continue

    const through = (now - transition.at) / transition.duration
    if (through < 0 || through > 1) continue
    // Up to full at the halfway mark, back down after: one row is one whole transition.
    veil = Math.max(veil, through <= 0.5 ? through * 2 : (1 - through) * 2)
  }
  return veil
}
