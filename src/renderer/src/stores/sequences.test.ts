import { beforeEach, describe, expect, it } from 'vitest'
import type { TakeShape } from '@/engines/audio/edits'
import { canRedo, canUndo } from '@/engines/core/history'
import { addClip } from '@/engines/timeline/commands'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import { EMPTY_SEQUENCE, EMPTY_SOUND_SEQUENCE, type Clip } from '@/engines/timeline/timeline-state'
import { sequenceHistoryOf, sequenceOf, useSequences, writeTakeClip } from './sequences'

const clip = clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' })

const clipsOf = (documentId: string): Clip[] =>
  sequenceOf(useSequences.getState(), documentId).tracks[0]?.clips ?? []

describe('sequences store', () => {
  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
  })

  it('gives an empty sequence for a document never opened', () => {
    expect(sequenceOf(useSequences.getState(), 'unknown')).toEqual(EMPTY_SEQUENCE)
  })

  it('runs a command against the right document', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    expect(clipsOf('doc-1')).toHaveLength(1)
    expect(clipsOf('doc-2')).toHaveLength(0)
  })

  it('keeps one history per document', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(true)
    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-2'))).toBe(false)
  })

  it('undoes and redoes within one document', () => {
    const { runCommand, undo, redo } = useSequences.getState()
    runCommand('doc-1', addClip('V1', clip))

    undo('doc-1')
    expect(clipsOf('doc-1')).toHaveLength(0)
    expect(canRedo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(true)

    redo('doc-1')
    expect(clipsOf('doc-1')).toHaveLength(1)
  })

  it('writes the playhead without touching the history: scrubbing is not an edit', () => {
    const state = { ...EMPTY_SEQUENCE, playhead: 2_000_000 }
    useSequences.getState().replace('doc-1', state)

    expect(sequenceOf(useSequences.getState(), 'doc-1').playhead).toBe(2_000_000)
    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(false)
  })

  it('forgets a sequence and its history when the document closes', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    useSequences.getState().drop('doc-1')

    expect(useSequences.getState().states['doc-1']).toBeUndefined()
    expect(useSequences.getState().histories['doc-1']).toBeUndefined()
  })
})

// The take under the Audio editor and the clip on the strip are two views of one thing: what is
// heard from the strip has to be what is heard from the editor, not merely look like it.
describe('the montage clip of an edited take', () => {
  const shape: TakeShape = {
    inPoint: 500_000,
    duration: 1_000_000,
    fadeIn: 200_000,
    fadeOut: 100_000,
    gain: -6,
  }

  const laid = (): Clip => {
    useSequences.getState().replace('doc-1', EMPTY_SOUND_SEQUENCE)
    useSequences.getState().runCommand('doc-1', addClip('A1', clip))
    return clipsOf('doc-1')[0] as Clip
  }

  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
  })

  it('carries the bounds, the ramps and the level of the chain above it', () => {
    laid()
    writeTakeClip('doc-1', 'clip-1', shape)

    expect(clipsOf('doc-1')[0]).toMatchObject({
      inPoint: 500_000,
      duration: 1_000_000,
      fadeIn: 200_000,
      fadeOut: 100_000,
      gain: -6,
    })
  })

  // Where a take sits on the strip and how fast it runs are decisions about the montage; the
  // editor above knows nothing of either.
  it('leaves where it sits and how fast it runs alone', () => {
    const before = laid()
    writeTakeClip('doc-1', 'clip-1', shape)

    expect(clipsOf('doc-1')[0]?.start).toBe(before.start)
    expect(clipsOf('doc-1')[0]?.speed).toBe(before.speed)
  })

  // The chain already owns ⌘Z in this workspace: a second entry per edit would make one press
  // give back half a change.
  it('writes outside the history, as the chain above owns the undo', () => {
    laid()
    const steps = sequenceHistoryOf(useSequences.getState(), 'doc-1').past.length
    writeTakeClip('doc-1', 'clip-1', shape)

    expect(sequenceHistoryOf(useSequences.getState(), 'doc-1').past).toHaveLength(steps)
  })

  // A render answers on every open, not only on an edit.
  it('does not touch the montage when the shape it already had comes back', () => {
    laid()
    writeTakeClip('doc-1', 'clip-1', shape)
    const settled = sequenceOf(useSequences.getState(), 'doc-1')

    writeTakeClip('doc-1', 'clip-1', shape)

    expect(sequenceOf(useSequences.getState(), 'doc-1')).toBe(settled)
  })
})
