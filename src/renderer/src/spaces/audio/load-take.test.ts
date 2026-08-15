import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { EMPTY_AUDIO_EDIT, pushEdit } from '@/engines/audio/edits'
import {
  EMPTY_SOUND_SEQUENCE,
  updateTrack,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timeline-state'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { sequenceOf, useSequences } from '@/stores/sequences'
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
const montageOf = (): SequenceState => sequenceOf(useSequences.getState(), 'doc-1')
const clipsOf = (): Clip[] => montageOf().tracks.flatMap(track => track.clips)

/** A document already holding a take, with one edit on it. */
function loaded(assetId: string): void {
  const store = useAudioEdits.getState()
  store.replace('doc-1', { ...EMPTY_AUDIO_EDIT, assetId })
  store.runCommand('doc-1', pushEdit({ kind: 'trimSilence' }))
}

describe('putting a take into the audio editor', () => {
  beforeEach(() => {
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: {}, histories: {} })
    useSequences.getState().replace('doc-1', EMPTY_SOUND_SEQUENCE)
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

// A take loaded over four empty tracks reads exactly like a load that did nothing, and the only
// way sound reached the strip used to be a drag from the shelf that nothing announced.
describe('the clip a take becomes on the montage under it', () => {
  beforeEach(() => {
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: {}, histories: {} })
    useSequences.getState().replace('doc-1', EMPTY_SOUND_SEQUENCE)
  })

  it('lands on the first sound track, and the chain knows which clip it is', () => {
    loadTake('doc-1', take())

    const [first] = montageOf().tracks
    expect(first?.clips.map(clip => clip.assetId)).toEqual(['take-1'])
    expect(editsOf().takeClipId).toBe(first?.clips[0]?.id)
  })

  it('replaces the previous take rather than stacking beside it', () => {
    loadTake('doc-1', take({ id: 'take-0' }))
    loadTake('doc-1', take())

    expect(clipsOf().map(clip => clip.assetId)).toEqual(['take-1'])
  })

  it('goes down a track when the first one is locked', () => {
    useSequences.getState().replace(
      'doc-1',
      updateTrack(montageOf(), 'A1', track => ({ ...track, locked: true })),
    )

    loadTake('doc-1', take())

    expect(montageOf().tracks[0]?.clips).toEqual([])
    expect(montageOf().tracks[1]?.clips.map(clip => clip.assetId)).toEqual(['take-1'])
  })

  // The window between a tab appearing and its file being read: the montage store answers with
  // the SEQUENCE default there, which carries a picture track this workspace cannot play.
  it('builds no montage at all for a document whose file is still on its way', () => {
    useSequences.setState({ states: {}, histories: {} })

    loadTake('doc-1', take())

    expect(useSequences.getState().states['doc-1']).toBeUndefined()
    expect(editsOf().takeClipId).toBeNull()
    expect(editsOf().assetId).toBe('take-1')
  })

  // Nowhere to lay it is not a reason to refuse the take itself: the editor still holds it, and
  // unlocking a track is a gesture away.
  it('still loads the take when every sound track refuses it', () => {
    const locked = montageOf().tracks.reduce(
      (state, track) => updateTrack(state, track.id, one => ({ ...one, locked: true })),
      montageOf(),
    )
    useSequences.getState().replace('doc-1', locked)

    loadTake('doc-1', take())

    expect(editsOf().assetId).toBe('take-1')
    expect(editsOf().takeClipId).toBeNull()
  })
})
