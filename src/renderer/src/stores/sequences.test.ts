import { beforeEach, describe, expect, it } from 'vitest'
import { canRedo, canUndo } from '@/engines/core/history'
import { addClip } from '@/engines/timeline/commands'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import { EMPTY_SEQUENCE, type Clip } from '@/engines/timeline/timeline-state'
import { sequenceHistoryOf, sequenceOf, useSequences } from './sequences'

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
