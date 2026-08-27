// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import {
  EMPTY_TIMELINE,
  TIMELINE_TEMPLATES,
  type AnimationTimeline,
} from '@shared/domain/animation'
import type { GameEvent } from '@shared/domain/gameEvent'
import type { Ref } from '@shared/domain/ref'
import type { AudioPort } from '../../ports/audioPort'
import { testPorts, testWorld } from '../world-fixtures'
import { createTimelineSystem } from './timeline'

const STEP = 1 / 60
const assetRef = (id: string): Ref => ({ kind: 'asset', id })

/** Every kind of row at once — a timeline no single template offers the whole of. */
const WHOLE: AnimationTimeline = {
  ...EMPTY_TIMELINE,
  events: [{ id: 'e1', at: 0, name: 'Opened' }],
  audio: [{ id: 'a1', assetId: 'music', start: 0, duration: 66_000 }],
  video: [{ id: 'v1', assetId: 'clip', start: 0, duration: 66_000 }],
  transitions: [{ id: 't1', at: 0, kind: 'fade', duration: 66_000 }],
}

/** What playing that timeline produced: everything a reader could tell apart. */
function played(timeline: AnimationTimeline) {
  const heard: GameEvent[] = []
  const sounds: string[] = []
  const veiled: number[] = []
  const audio: AudioPort = {
    play: ref => {
      sounds.push(ref.kind === 'asset' ? ref.id : '')
      return { stop: () => {}, gain: () => {} }
    },
    stopAll: () => {},
  }
  const world = testWorld({
    ports: testPorts({
      audio,
      render: { place: () => {}, view: () => {}, veil: amount => veiled.push(amount) },
    }),
    systems: [createTimelineSystem({ timeline, assetRef })],
  })
  world.events.onAny(event => heard.push(event))

  for (let at = 0; at < 4; at++) world.step(STEP)
  return {
    events: heard.filter(one => one.name === 'Custom').map(one => String(one.payload.name)),
    sounds,
    veiled,
  }
}

/**
 * 🛑 The guard the plan asks for by name: **no template takes a capability away from the engine.**
 *
 * `template` decides which rows the PANEL offers — a filter of view, like `sheet` — and the
 * engine plays every row of a timeline whatever it says. Written as a comparison rather than as
 * an assertion on the field: what has to hold is that the RESULT is the same, and a system that
 * grew a reading of `template` would fail here without anyone having to remember this rule.
 */
describe('a timeline played under each template', () => {
  const reference = played(WHOLE)

  it.each(TIMELINE_TEMPLATES)('plays exactly the same under %s', template => {
    expect(played({ ...WHOLE, template })).toEqual(reference)
  })

  it('played something at all, so the comparison above is not between two empties', () => {
    expect(reference.events).toContain('Opened')
    expect(reference.sounds).toContain('music')
    expect(Math.max(...reference.veiled)).toBeGreaterThan(0)
  })

  /** The other direction: nothing of the engine even READS the field. */
  it('never reads the template at all', async () => {
    const source = await import('./timeline?raw')

    expect(String(source.default)).not.toContain('template')
  })
})
