// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import type { GameEvent } from '@shared/domain/gameEvent'
import type { Ref } from '@shared/domain/ref'
import type { AudioPort, AudioVoice } from '../../ports/audioPort'
import { testPorts, testWorld } from '../world-fixtures'
import { createTimelineSystem } from './timeline'

const STEP = 1 / 60
const assetRef = (id: string): Ref => ({ kind: 'asset', id })

/** A sound port that says what it was asked to play, and what was stopped. */
function listening() {
  const played: string[] = []
  const stopped: string[] = []
  const audio: AudioPort = {
    play: ref => {
      played.push(ref.kind === 'asset' ? ref.id : '')
      const voice: AudioVoice = {
        stop: () => void stopped.push(ref.kind === 'asset' ? ref.id : ''),
      }
      return voice
    },
    stopAll: () => {},
  }
  return { audio, played, stopped }
}

function running(timeline: Partial<AnimationTimeline>, over: Partial<AudioPort> = {}) {
  const heard: GameEvent[] = []
  const veiled: number[] = []
  const sound = listening()
  const world = testWorld({
    ports: testPorts({
      audio: { ...sound.audio, ...over },
      render: { place: () => {}, view: () => {}, veil: amount => veiled.push(amount) },
    }),
    systems: [createTimelineSystem({ timeline: { ...EMPTY_TIMELINE, ...timeline }, assetRef })],
  })
  world.events.onAny(event => heard.push(event))
  return { world, heard, veiled, ...sound }
}

/** What a timeline DOES while a game runs, as opposed to what it moves. */
describe('a timeline playing inside a game', () => {
  it('puts an event on the bus when the head reaches it, and once only', () => {
    const { world, heard } = running({
      events: [{ id: 'e1', at: 20_000, name: 'DoorOpened', payload: { side: 'north' } }],
    })

    for (let at = 0; at < 5; at++) world.step(STEP)

    const said = heard.filter(one => one.payload.name === 'DoorOpened')
    expect(said).toHaveLength(1)
    expect(said[0]?.payload.side).toBe('north')
  })

  it('holds an event back until its instant', () => {
    const { world, heard } = running({ events: [{ id: 'e1', at: 500_000, name: 'Late' }] })

    world.step(STEP)

    expect(heard.filter(one => one.payload.name === 'Late')).toEqual([])
  })

  it('starts a sound at its instant and stops it at its end', () => {
    const { world, played, stopped } = running({
      audio: [{ id: 'a1', assetId: 'music', start: 0, duration: 33_000 }],
    })

    world.step(STEP)
    expect(played).toEqual(['music'])

    for (let at = 0; at < 3; at++) world.step(STEP)
    expect(stopped).toEqual(['music'])
  })

  /** 🛑 A game started again is a timeline due all over: nothing may stay fired from last time. */
  it('plays everything again when the clock goes back', () => {
    const { world, heard } = running({ events: [{ id: 'e1', at: 0, name: 'Opened' }] })

    for (let at = 0; at < 3; at++) world.step(STEP)
    world.time.elapsed = 0
    world.step(STEP)

    expect(heard.filter(one => one.payload.name === 'Opened')).toHaveLength(2)
  })

  it('veils the picture through a fade, and not at all through a cut', () => {
    const faded = running({ transitions: [{ id: 't1', at: 0, kind: 'fade', duration: 66_000 }] })
    for (let at = 0; at < 3; at++) faded.world.step(STEP)

    const cut = running({ transitions: [{ id: 't2', at: 0, kind: 'cut', duration: 66_000 }] })
    for (let at = 0; at < 3; at++) cut.world.step(STEP)

    expect(Math.max(...faded.veiled)).toBeGreaterThan(0)
    expect(Math.max(...cut.veiled)).toBe(0)
  })

  /** A host with no sound to give answers nothing, and the game plays on. */
  it('carries on when the host has no sound to give', () => {
    const { world } = running(
      { audio: [{ id: 'a1', assetId: 'music', start: 0, duration: 33_000 }] },
      { play: () => null },
    )

    expect(() => world.step(STEP)).not.toThrow()
  })

  it('does nothing at all for a scene that carries no rows', () => {
    const { world, heard, played } = running({})

    for (let at = 0; at < 5; at++) world.step(STEP)

    expect(played).toEqual([])
    expect(heard.filter(one => one.name === 'Custom')).toEqual([])
  })
})
