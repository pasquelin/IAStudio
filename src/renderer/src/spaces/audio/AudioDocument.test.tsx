import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { canUndo } from '@/engines/core/history'
import { EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { useDocuments } from '@/stores/documents'
import { installDocuments } from '@/stores/document-fixtures'
import { AudioDocument } from './AudioDocument'

import type { SaveAudioRequest } from '@shared/ipc'

const saveAudio = vi.fn((_request: SaveAudioRequest) => Promise.resolve(asset))

// jsdom has no AudioContext and wavesurfer needs a real canvas: both are exercised by hand.
// What this covers is the chain — which tool appends which step, and what reaches the disk.
vi.mock('./decode', () => ({
  decodeAsset: () =>
    Promise.resolve({ sampleRate: 100, channels: [new Float32Array(200).fill(0.5)] }),
}))

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
  it('loads the take that was dropped on the empty editor', () => {
    useAssets.setState({ items: [asset] })
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-1', type: 'audio' })

    fireEvent.drop(emptyEditor(), { dataTransfer })

    expect(editsOf().assetId).toBe('asset-1')
  })

  it('refuses a picture, which the editor has nothing to do with', () => {
    useAssets.setState({ items: [{ ...asset, id: 'asset-pic', type: 'image' }] })
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-pic', type: 'image' })

    // A refused drag is one the browser never lets land: `preventDefault` is not called.
    expect(fireEvent.dragOver(emptyEditor(), { dataTransfer })).toBe(true)
  })
})
