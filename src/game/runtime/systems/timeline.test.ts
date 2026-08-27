// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import type { GameEvent } from '@shared/domain/gameEvent'
import type { Ref } from '@shared/domain/ref'
import type { AudioPort, AudioVoice } from '../../ports/audioPort'
import { notedScenes } from '../scene-fixtures'
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
  const scenes = notedScenes()
  const sound = listening()
  const world = testWorld({
    ports: testPorts({
      audio: { ...sound.audio, ...over },
      render: { place: () => {}, view: () => {}, veil: amount => veiled.push(amount) },
      scenes,
    }),
    systems: [createTimelineSystem({ timeline: { ...EMPTY_TIMELINE, ...timeline }, assetRef })],
  })
  world.events.onAny(event => heard.push(event))
  return { world, heard, veiled, wanted: scenes.wanted, ...sound }
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

  /**
   * 🛑 ONE at a time, the last of the list that runs — the rule a montage settles an overlap by.
   * Combined, two fades that overlap made the picture go dark, open back up, and go dark again.
   */
  it('lets the last transition of the list decide while two overlap', () => {
    const { world, veiled } = running({
      transitions: [
        { id: 't1', at: 0, kind: 'fade', duration: 100_000 },
        { id: 't2', at: 50_000, kind: 'fade', duration: 100_000 },
      ],
    })

    for (let at = 0; at < 10; at++) world.step(STEP)

    // At the fifth step both run: the first is two thirds of the way in, the second a sixth.
    // The second one owns the instant, so the picture is barely veiled rather than nearly dark.
    expect(veiled[4]).toBeCloseTo(0.333, 2)
  })

  /** An instant that is not a finite number is not an instant: it never comes due. */
  it('never fires a row whose instant is not a number', () => {
    const { world, heard } = running({ events: [{ id: 'e1', at: Number.NaN, name: 'Never' }] })

    for (let at = 0; at < 5; at++) world.step(STEP)

    expect(heard.filter(one => one.payload.name === 'Never')).toEqual([])
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

const SECOND = 1_000_000

/** 🛑 The multi-scene lot: the row that was read back and never played. */
describe('a transition that goes somewhere', () => {
  it('asks for its scene at the HALFWAY mark, where the veil is full, and once only', () => {
    const { world, wanted } = running({
      transitions: [{ id: 't', at: 0, kind: 'fade', duration: SECOND, scene: 'World01' }],
    })

    for (let at = 0; at < 20; at++) world.step(STEP)
    expect(wanted).toEqual([])

    for (let at = 0; at < 20; at++) world.step(STEP)
    expect(wanted).toEqual([{ scene: 'World01', fade: 0.5 }])
  })

  /** A cut veils nothing and goes at once — « couper vers World02 » means exactly that. */
  it('goes at its own instant for a cut, with no fade to lift', () => {
    const { world, wanted, veiled } = running({
      transitions: [{ id: 't', at: 0, kind: 'cut', duration: 0, scene: 'World02' }],
    })

    world.step(STEP)

    expect(wanted).toEqual([{ scene: 'World02', fade: 0 }])
    expect(veiled.filter(one => one > 0)).toEqual([])
  })

  it('leaves a transition that names no scene where it is', () => {
    const { world, wanted } = running({
      transitions: [{ id: 't', at: 0, kind: 'fade', duration: SECOND }],
    })

    for (let at = 0; at < 60; at++) world.step(STEP)

    expect(wanted).toEqual([])
  })
})
