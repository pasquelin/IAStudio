import { describe, expect, it } from 'vitest'
import { audioChunksIn } from './audio'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import type { Clip, SequenceState } from './timeline-state'

const clip = (id: string, start: number, duration: number, inPoint = 0): Clip =>
  clipFixture(id, start, duration, { inPoint })

const withAudio = (clips: Clip[], muted = false): SequenceState =>
  sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio', clips, { muted })])

describe('audio scheduling', () => {
  it('plans nothing when the window holds no clip', () => {
    expect(audioChunksIn(withAudio([clip('a', 5_000_000, 1_000_000)]), 0, 1_000_000)).toEqual([])
  })

  it('plans a chunk for a clip inside the window', () => {
    const chunks = audioChunksIn(withAudio([clip('a', 1_000_000, 2_000_000)]), 0, 4_000_000)
    expect(chunks).toEqual([
      {
        trackId: 'A1',
        clipId: 'a',
        assetId: 'asset-a',
        at: 1_000_000,
        sourceStart: 0,
        duration: 2_000_000,
      },
    ])
  })

  it('clips the chunk to the window and moves the source start with it', () => {
    const chunks = audioChunksIn(
      withAudio([clip('a', 0, 4_000_000, 500_000)]),
      1_000_000,
      2_000_000,
    )
    expect(chunks[0]).toMatchObject({
      at: 1_000_000,
      sourceStart: 1_500_000,
      duration: 1_000_000,
    })
  })

  it('skips a muted track, which is what a mute button has to mean', () => {
    expect(audioChunksIn(withAudio([clip('a', 0, 1_000_000)], true), 0, 2_000_000)).toEqual([])
  })

  it('ignores video tracks: the picture is not scheduled, it is painted', () => {
    const state = sequenceWith([trackFixture('V1', 'video', [clip('v', 0, 1)])])
    expect(audioChunksIn(state, 0, 2_000_000)).toEqual([])
  })

  it('accounts for speed when mapping into the source', () => {
    const fast = { ...clip('a', 0, 2_000_000), speed: 2 }
    expect(audioChunksIn(withAudio([fast]), 1_000_000, 2_000_000)[0]?.sourceStart).toBe(2_000_000)
  })
})
