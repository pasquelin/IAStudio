import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { canUndo } from '@/engines/core/history'
import { EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { SECOND } from '@shared/domain/time'
import { addClip } from '@/engines/timeline/commands'
import { makeClip, EMPTY_SOUND_SEQUENCE } from '@/engines/timeline/timeline-state'
import { useAssets } from '@/stores/assets'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { useDocuments } from '@/stores/documents'
import { installDocuments } from '@/stores/document-fixtures'
import { AudioDocument } from './AudioDocument'

import type { SaveAudioRequest } from '@shared/ipc'

const saveAudio = vi.fn((_request: SaveAudioRequest) => Promise.resolve(asset))

// jsdom has no AudioContext and wavesurfer needs a real canvas: both are exercised by hand.
// What this covers is the chain — which tool appends which step, and what reaches the disk.
const decodeAsset = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ sampleRate: 100, channels: [new Float32Array(200).fill(0.5)] })),
)

vi.mock('@/helpers/audio-decode', () => ({ decodeAsset }))

vi.mock('./useWaveSurfer', () => ({
  useWaveSurfer: () => ({ playing: false, currentTime: 0, toggle: vi.fn(), seek: vi.fn() }),
}))

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({ assets: { saveAudio } }),
}))

const asset: Asset = {
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
}

const editsOf = () => audioEditsOf(useAudioEdits.getState(), 'doc-1')

// Every suite in this file, not one: a document left behind sends `useRestoredDocument`
// reaching for a bridge these tests do not mount.
beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
})

async function openTake({ inFront = true }: { inFront?: boolean } = {}): Promise<void> {
  useAudioEdits.setState({
    states: { 'doc-1': { ...EMPTY_AUDIO_EDIT, assetId: 'asset-1' } },
    histories: {},
  })
  // Two tabs when the take is meant to be behind: what puts another document in front is
  // another document, not an empty `activeId`.
  installDocuments(
    inFront ? { 'doc-1': 'audio' } : { 'doc-1': 'audio', 'doc-2': 'audio' },
    inFront ? 'doc-1' : 'doc-2',
  )
  render(<AudioDocument documentId="doc-1" />)
  // The chain is replayed off this thread now, so the take is not there on the first render:
  // a tool clicked while it still says "loading" would act on nothing.
  await waitFor(() => expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument())
}

describe('AudioDocument', () => {
  beforeEach(() => {
    saveAudio.mockClear()
    useAssets.setState({ items: [asset] })
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: { 'doc-1': EMPTY_SOUND_SEQUENCE }, histories: {} })
  })

  // The bar carried the only undo this space had until `audio.undo` was registered — which is
  // what let the pair leave every bar in the studio.
  describe('its history', () => {
    it('is not drawn on the bar', async () => {
      await openTake()
      expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
    })

    it('answers the key while the take is the tab in front', async () => {
      await openTake()
      await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      expect(editsOf().edits).toEqual([])
    })

    it('stays deaf while another tab is in front', async () => {
      await openTake({ inFront: false })
      await userEvent.click(screen.getByRole('button', { name: /Couper les silences/ }))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      expect(editsOf().edits).toEqual([{ kind: 'trimSilence' }])
    })

    // One key, one document, two stores: the montage under the take answers ⌘Z only when the
    // chain has nothing left to give back. Nothing else can reach it — the strip's own scope is
    // off, precisely so that one press never undoes both halves.
    it('gives the key to the montage when the chain has nothing to undo', async () => {
      await openTake()
      const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: SECOND })
      useSequences.getState().runCommand('doc-1', addClip('A1', clip))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      expect(sequenceOf(useSequences.getState(), 'doc-1').tracks[0]?.clips).toEqual([])
    })

    it('undoes the chain first, leaving the montage where it stands', async () => {
      await openTake()
      const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: SECOND })
      useSequences.getState().runCommand('doc-1', addClip('A1', clip))
      await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      expect(editsOf().edits).toEqual([])
      expect(sequenceOf(useSequences.getState(), 'doc-1').tracks[0]?.clips).toHaveLength(1)
    })
  })

  // The take under the editor and the clip on the strip are two views of one thing.
  describe('the clip it keeps in step', () => {
    const takeClip = () => sequenceOf(useSequences.getState(), 'doc-1').tracks[0]?.clips[0]

    /** A document whose take is already laid down on the strip, as `loadTake` leaves it. */
    async function openLaidTake(): Promise<void> {
      useSequences
        .getState()
        .runCommand(
          'doc-1',
          addClip('A1', makeClip({ id: 'clip-1', assetId: 'asset-1', start: 0, duration: SECOND })),
        )
      useAudioEdits.setState({
        states: { 'doc-1': { ...EMPTY_AUDIO_EDIT, assetId: 'asset-1', takeClipId: 'clip-1' } },
        histories: {},
      })
      installDocuments({ 'doc-1': 'audio' }, 'doc-1')
      render(<AudioDocument documentId="doc-1" />)
      await waitFor(() => expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument())
    }

    // 13 frames at 25 fps rather than the 12.5 the crop asked for: a clip lands on the frame
    // grid, exactly as one laid down by hand does — a tail off the grid snaps to nothing.
    const CROPPED = 520_000

    it('shortens the clip when the take is cropped', async () => {
      await openLaidTake()
      await waitFor(() => expect(takeClip()?.duration).toBe(2_000_000))

      useAudioEdits.getState().replace('doc-1', { ...editsOf(), region: { from: 0, to: 500_000 } })
      await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

      await waitFor(() => expect(takeClip()?.duration).toBe(CROPPED))
    })

    /**
     * A bypassed render is asked for an EMPTY chain, so the shape that comes back is the whole
     * untouched take. Written down, one press of A/B would stretch the clip back to the source —
     * turning a listening aid into an edit of the montage.
     */
    it('leaves the clip alone while A/B is held on the source', async () => {
      await openLaidTake()
      useAudioEdits.getState().replace('doc-1', { ...editsOf(), region: { from: 0, to: 500_000 } })
      await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))
      await waitFor(() => expect(takeClip()?.duration).toBe(CROPPED))

      await userEvent.click(screen.getByRole('button', { name: /A\/B/ }))

      await waitFor(() => expect(editsOf().bypassed).toBe(true))
      expect(takeClip()?.duration).toBe(CROPPED)
    })

    // And on the way back: the press that leaves bypass re-runs the write before its own render
    // has landed, so what is in hand at that moment is still the BYPASSED answer.
    it('leaves the clip alone on the press that comes back off A/B', async () => {
      await openLaidTake()
      useAudioEdits.getState().replace('doc-1', { ...editsOf(), region: { from: 0, to: 500_000 } })
      await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))
      await waitFor(() => expect(takeClip()?.duration).toBe(CROPPED))

      await userEvent.click(screen.getByRole('button', { name: /A\/B/ }))
      await waitFor(() => expect(editsOf().bypassed).toBe(true))
      await userEvent.click(screen.getByRole('button', { name: /A\/B/ }))
      await waitFor(() => expect(editsOf().bypassed).toBe(false))

      expect(takeClip()?.duration).toBe(CROPPED)
    })
  })

  /**
   * The pair is what the space was missing: an editor alone showed ONE take while the strip
   * below showed several, and nothing on screen said how the two were related. Each half says
   * which one it is, under its own bar — that line is the whole explanation.
   */
  it('shows both halves of the pair, each saying which one it is', async () => {
    await openTake()

    expect(screen.getByText(/La prise que vous éditez/)).toBeInTheDocument()
    expect(screen.getByText(/Le montage entier/)).toBeInTheDocument()
  })

  it('asks for a take when none is open', () => {
    render(<AudioDocument documentId="doc-1" />)
    expect(screen.getByText(/Aucun son ouvert/)).toBeInTheDocument()
  })

  it('appends a step rather than rewriting the take', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

    expect(editsOf().edits).toEqual([{ kind: 'normalize', targetLufs: -14 }])
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(true)
  })

  it('trims the silence at both ends as one step', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Couper les silences/ }))

    expect(editsOf().edits).toEqual([{ kind: 'trimSilence' }])
  })

  it('refuses to crop with nothing selected, rather than emptying the take', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

    expect(editsOf().edits).toEqual([])
  })

  it('crops to the selected region', async () => {
    await openTake()
    useAudioEdits.getState().replace('doc-1', { ...editsOf(), region: { from: 0, to: 500_000 } })

    await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

    expect(editsOf().edits).toEqual([{ kind: 'crop', from: 0, to: 500_000 }])
  })

  it('keeps A/B off the undo stack: it changes what is heard, not what was done', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /A\/B/ }))

    expect(editsOf().bypassed).toBe(true)
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(false)
  })

  it('writes over the source on apply', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))

    await waitFor(() => expect(saveAudio).toHaveBeenCalled())
    expect(saveAudio.mock.calls[0]?.[0]).toMatchObject({ replaces: 'asset-1', name: 'pad.wav' })
  })

  it('writes beside the source on save as, and keeps them traceable', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Enregistrer comme nouveau/ }))

    await waitFor(() => expect(saveAudio).toHaveBeenCalled())
    expect(saveAudio.mock.calls[0]?.[0]).toMatchObject({
      derivedFrom: 'asset-1',
      name: 'pad.wav (édité)',
    })
  })

  it('hands the disk a real wav, not an empty buffer', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))

    await waitFor(() => expect(saveAudio).toHaveBeenCalled())
    const wav = saveAudio.mock.calls[0]?.[0].wav ?? new Uint8Array()
    // 200 mono frames at 16 bits, behind a 44-byte header.
    expect(wav.byteLength).toBe(44 + 200 * 2)
  })

  /**
   * The file now HOLDS the chain. Replaying it over the new bytes would lay every fade and gain
   * down a second time, and the montage clip below — which carries them too — would play them a
   * third. A step undone afterwards would describe a length the file no longer has.
   */
  it('empties the chain and its history once the take has been written over', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))
    expect(editsOf().edits).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))
    await waitFor(() => expect(editsOf().edits).toEqual([]))

    expect(editsOf().assetId).toBe('asset-1')
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(false)
  })

  // "Save as" writes a NEW asset: the take under the editor is untouched, and so is its chain.
  it('keeps the chain when the take is written beside the source', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer comme nouveau/ }))
    await waitFor(() => expect(saveAudio).toHaveBeenCalled())

    expect(editsOf().edits).toHaveLength(1)
  })
})

describe('dropping a take on the editor', () => {
  const emptyEditor = (): Element => {
    render(<AudioDocument documentId="doc-1" />)
    return screen.getByText(/Déposez une prise/).closest('div[class]') ?? document.body
  }

  beforeEach(() => {
    useAudioEdits.setState({ states: {}, histories: {} })
  })

  // The last space that accepted nothing: a take had to be double-clicked from the shelf, and
  // nothing on screen said the editor would have taken it.
  it('loads the take that was dropped on the empty editor', async () => {
    useAssets.setState({ items: [asset] })
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'audio' })

    fireEvent.drop(emptyEditor(), { dataTransfer })

    // Settled first: a drop resolves through `droppedAsset`, which may fetch a library asset
    // before handing it over, so the answer lands a microtask later even when nothing was fetched.
    await Promise.resolve()

    expect(editsOf().assetId).toBe('asset-1')
  })

  // A tab that only says "undecodable" is a dead end: the gesture that would replace the take
  // is the very one it stopped accepting.
  it('still takes a drop once the take it holds turned out to be undecodable', async () => {
    decodeAsset.mockRejectedValueOnce(new Error('not audio'))
    useAssets.setState({ items: [asset, { ...asset, id: 'asset-2', name: 'other.wav' }] })
    useAudioEdits.setState({
      states: { 'doc-1': { ...EMPTY_AUDIO_EDIT, assetId: 'asset-1' } },
      histories: {},
    })

    render(<AudioDocument documentId="doc-1" />)
    const dead = await screen.findByText(/n’a pas pu être décodé/)

    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-2', type: 'audio' })
    fireEvent.drop(dead.closest('div[class]') ?? document.body, { dataTransfer })
    await Promise.resolve()

    expect(editsOf().assetId).toBe('asset-2')
  })

  it('refuses a picture, which the editor has nothing to do with', () => {
    useAssets.setState({ items: [{ ...asset, id: 'asset-pic', type: 'image' }] })
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-pic', type: 'image' })

    // A refused drag is one the browser never lets land: `preventDefault` is not called.
    expect(fireEvent.dragOver(emptyEditor(), { dataTransfer })).toBe(true)
  })
})
