import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { EMPTY_AUDIO_EDIT, pushEdit } from '@/engines/audio/edits'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { loadTake } from './load-take'

const take = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'take-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const editsOf = () => audioEditsOf(useAudioEdits.getState(), 'doc-1')

/** A document already holding a take, with one edit on it. */
function loaded(assetId: string): void {
  const store = useAudioEdits.getState()
  store.replace('doc-1', { ...EMPTY_AUDIO_EDIT, assetId })
  store.runCommand('doc-1', pushEdit({ kind: 'trimSilence' }))
}

describe('putting a take into the audio editor', () => {
  beforeEach(() => {
    useAudioEdits.setState({ states: {}, histories: {} })
  })

  it('loads the take onto an empty editor', () => {
    loadTake('doc-1', take())

    expect(editsOf().assetId).toBe('take-1')
  })

  it('takes nothing that is not sound', () => {
    loadTake('doc-1', take({ type: 'image' }))

    expect(editsOf().assetId).toBeNull()
  })

  // An edit is a length and a region measured against the take it was made on. Carried over to
  // another take they describe nothing, and "apply" would write that nothing over the file.
  it('drops the chain and its history when the take changes', () => {
    loaded('take-0')
    expect(editsOf().edits.length).toBeGreaterThan(0)

    loadTake('doc-1', take())

    expect(editsOf().assetId).toBe('take-1')
    expect(editsOf().edits).toEqual([])
    expect(audioHistoryOf(useAudioEdits.getState(), 'doc-1').past).toEqual([])
  })

  // Reopening the same take from the shelf is not a reason to throw away what was done to it.
  it('leaves the work alone when the take is the one already loaded', () => {
    loaded('take-1')
    const before = editsOf().edits

    loadTake('doc-1', take())

    expect(editsOf().edits).toBe(before)
  })
})
