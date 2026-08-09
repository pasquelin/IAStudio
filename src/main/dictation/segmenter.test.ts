import { describe, expect, it } from 'vitest'
import { STT_SAMPLE_RATE } from '@shared/domain/dictation'
import {
  emptyHeld,
  flatten,
  hold,
  MAX_HELD_SECONDS,
  PREROLL_SECONDS,
  previewOf,
  secondsOf,
} from './segmenter'

const chunk = (length: number, value = 0): Float32Array => new Float32Array(length).fill(value)

const holdAll = (...chunks: Float32Array[]) => chunks.reduce(hold, emptyHeld())

describe('hold', () => {
  it('accumulates chunks and their length', () => {
    const held = holdAll(chunk(1_600), chunk(1_600))

    expect(held.chunks).toHaveLength(2)
    expect(held.length).toBe(3_200)
    expect(held.dropped).toBe(0)
  })

  // A queue that only grows turns a slow machine into one transcribing what was said a minute
  // ago. Past the bound the oldest audio goes, and says so.
  it('drops the oldest audio past the bound, and counts what it dropped', () => {
    const second = new Float32Array(STT_SAMPLE_RATE)
    let held = emptyHeld()
    for (let index = 0; index < MAX_HELD_SECONDS + 2; index += 1) held = hold(held, second)

    expect(secondsOf(held.length)).toBeLessThanOrEqual(MAX_HELD_SECONDS)
    expect(secondsOf(held.dropped)).toBe(2)
  })

  it('keeps the newest chunk even when it alone passes the bound', () => {
    const huge = new Float32Array((MAX_HELD_SECONDS + 5) * STT_SAMPLE_RATE)
    const held = hold(emptyHeld(), huge)

    expect(held.chunks).toHaveLength(1)
    expect(held.dropped).toBe(0)
  })
})

describe('flatten', () => {
  it('lays the chunks end to end, in order', () => {
    const held = holdAll(chunk(2, 0.25), chunk(3, 0.5))

    expect([...flatten(held)]).toEqual([0.25, 0.25, 0.5, 0.5, 0.5])
  })

  it('is empty when nothing is held', () => {
    expect(flatten(emptyHeld())).toHaveLength(0)
  })
})

describe('previewOf', () => {
  const preroll = Math.round(PREROLL_SECONDS * STT_SAMPLE_RATE)

  // Silero needs a few frames to be sure someone is speaking, so what is kept from just before
  // that moment is what keeps a preview from opening mid-word.
  it('reaches back before speech was detected', () => {
    const held = holdAll(chunk(preroll * 2, 0.1), chunk(1_600, 0.9))

    expect(previewOf(held, 1_600)).toHaveLength(1_600 + preroll)
  })

  it('never reaches past what is held', () => {
    const held = holdAll(chunk(800, 0.4))

    expect([...previewOf(held, 800)]).toEqual([...new Float32Array(800).fill(0.4)])
  })

  it('ends on the newest sample, which is the one just spoken', () => {
    const held = holdAll(chunk(4_000, 0.1), chunk(2, 0.7))
    const preview = previewOf(held, 2)

    expect(preview[preview.length - 1]).toBeCloseTo(0.7, 6)
  })
})
