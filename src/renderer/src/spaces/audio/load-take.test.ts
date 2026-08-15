import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import {
  EMPTY_SOUND_SEQUENCE,
  SECOND,
  updateTrack,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timeline-state'
import { useSelection } from '@/stores/selection'
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

const montageOf = (): SequenceState => sequenceOf(useSequences.getState(), 'doc-1')
const clipsOf = (): Clip[] => montageOf().tracks.flatMap(track => track.clips)

/**
 * Loading a take is now one thing and no longer two: a block on the montage, selected. The
 * editor below shows whichever block is selected, so that is all it takes to open it — and the
 * chain is the block's own, which is why nothing here touches it.
 */
describe('putting a take onto the montage', () => {
  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
    useSequences.getState().replace('doc-1', EMPTY_SOUND_SEQUENCE)
    useSelection.getState().clear()
  })

  it('lands on the first sound track, and selects what it laid', () => {
    loadTake('doc-1', take())

    const [first] = montageOf().tracks
    const laid = first?.clips[0]
    expect(first?.clips.map(clip => clip.assetId)).toEqual(['take-1'])
    // Both selections: the montage's own is what the editor reads, this one is what the
    // inspector reads, and a block shown in one and described by neither is half a selection.
    expect(montageOf().selectedId).toBe(laid?.id)
    expect(useSelection.getState().selection).toEqual({
      kind: 'clip',
      ownerId: 'doc-1',
      ids: [laid?.id],
    })
  })

  it('takes nothing that is not sound', () => {
    loadTake('doc-1', take({ type: 'image' }))

    expect(clipsOf()).toEqual([])
  })

  /**
   * Where this used to take the previous take's block off the strip, wherever it sat. Blocks
   * accumulate on a montage — that is what a montage IS — and each one carries its own chain.
   *
   * What decides is the montage's own insert rule and no longer this function: a take lands at
   * the head, over whatever was there. Two takes loaded without moving the head are two takes
   * asked for in the same place, and the second wins — see the case below.
   */
  it('leaves the previous take where it sits when the head has moved on', () => {
    loadTake('doc-1', take({ id: 'take-0' }))
    useSequences.getState().replace('doc-1', { ...montageOf(), playhead: 30 * SECOND })

    loadTake('doc-1', take())

    expect(clipsOf().map(clip => clip.assetId)).toEqual(['take-0', 'take-1'])
  })

  /**
   * Asking for the take that is already under the editor. Without this, the second ask lays a
   * new block over the one holding these very bytes — same take, new id — and the chain that
   * named the old id goes with it, settings and all, with nothing on screen to say so.
   */
  it('changes nothing when the take asked for is the one already shown', () => {
    loadTake('doc-1', take())
    const before = useSequences.getState().states['doc-1']

    loadTake('doc-1', take())

    expect(useSequences.getState().states['doc-1']).toBe(before)
  })

  it('lays it over what the head stands on, as any other drop would', () => {
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
    expect(useSelection.getState().selection).toEqual({ kind: 'none' })
  })

  // A montage whose sound tracks are all locked has nowhere to put this. Refusing beats laying
  // a block where nothing would play it, and nothing is selected on the way out.
  it('selects nothing when every sound track refuses it', () => {
    const locked = montageOf().tracks.reduce(
      (state, track) => updateTrack(state, track.id, one => ({ ...one, locked: true })),
      montageOf(),
    )
    useSequences.getState().replace('doc-1', locked)

    loadTake('doc-1', take())

    expect(clipsOf()).toEqual([])
    expect(useSelection.getState().selection).toEqual({ kind: 'none' })
  })
})
