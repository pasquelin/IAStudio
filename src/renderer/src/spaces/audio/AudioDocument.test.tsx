import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { canUndo } from '@/engines/core/history'
import {
  chainOf,
  EMPTY_AUDIO_EDIT,
  pushEdit,
  withChain,
  type TakeChain,
} from '@/engines/audio/edits'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { SECOND } from '@shared/domain/time'
import { addClip } from '@/engines/timeline/commands'
import { makeClip, updateClip, EMPTY_SOUND_SEQUENCE } from '@/engines/timeline/timeline-state'
import { useAssets } from '@/stores/assets'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
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

/** The block every test here edits — the editor below the montage shows the selected one. */
const CLIP = 'clip-1'

const editsOf = (clipId: string = CLIP): TakeChain =>
  chainOf(audioEditsOf(useAudioEdits.getState(), 'doc-1'), clipId)

/** That block's chain written back, out of the history, as the editor writes a region. */
function writeChain(fields: Partial<TakeChain>): void {
  const store = useAudioEdits.getState()
  const current = audioEditsOf(store, 'doc-1')
  store.replace('doc-1', withChain(current, CLIP, { ...chainOf(current, CLIP), ...fields }))
}

/** The block the editor is on — the montage of these suites holds it first on its only track. */
const takeClip = () => sequenceOf(useSequences.getState(), 'doc-1').tracks[0]?.clips[0]

const laidAssetIds = (): string[] =>
  sequenceOf(useSequences.getState(), 'doc-1')
    .tracks.flatMap(track => track.clips)
    .map(clip => clip.assetId)

/** A montage holding one two-second block of `asset-1`, selected — what the editor shows. */
function montageWithTake(): void {
  const laid = addClip(
    'A1',
    makeClip({ id: CLIP, assetId: 'asset-1', start: 0, duration: 2 * SECOND }),
  ).apply(EMPTY_SOUND_SEQUENCE)

  useSequences.setState({ states: { 'doc-1': { ...laid, selectedId: CLIP } }, histories: {} })
}

// Every suite in this file, not one: a document left behind sends `useRestoredDocument`
// reaching for a bridge these tests do not mount.
beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
})

async function openTake({ inFront = true }: { inFront?: boolean } = {}): Promise<void> {
  useAudioEdits.setState({ states: { 'doc-1': EMPTY_AUDIO_EDIT }, histories: {} })
  montageWithTake()
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

  it('says what its tools act on: the gesture while there is nothing, the range once there is', async () => {
    await openTake()
    expect(screen.getByText(/Glissez sur l’onde/)).toBeInTheDocument()

    writeChain({ region: { from: SECOND / 2, to: SECOND } })

    expect(await screen.findByText('Sélection 00:00.50 – 00:01.00')).toBeInTheDocument()
    // And the invitation goes: the bar says one thing at a time, or it says both at once.
    expect(screen.queryByText(/Glissez sur l’onde/)).not.toBeInTheDocument()
  })

  // Clamped like the tools clamp it: the take is two seconds long, so a range past its end is a
  // range no tool would touch, and announcing it would be the bar promising what nothing does.
  it('takes a selection the take no longer holds for no selection at all', async () => {
    await openTake()

    writeChain({ region: { from: 9 * SECOND, to: 12 * SECOND } })

    expect(await screen.findByText(/Glissez sur l’onde/)).toBeInTheDocument()
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
      await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      expect(editsOf().edits).toEqual([{ kind: 'normalize', targetLufs: -14 }])
    })

    // One key, one document, two stores: the montage under the take answers ⌘Z only when the
    // chain has nothing left to give back. Nothing else can reach it — the strip's own scope is
    // off, precisely so that one press never undoes both halves.
    it('gives the key to the montage when the chain has nothing to undo', async () => {
      await openTake()
      const clip = makeClip({
        id: 'clip-2',
        assetId: 'asset-a',
        start: 5 * SECOND,
        duration: SECOND,
      })
      useSequences.getState().runCommand('doc-1', addClip('A1', clip))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      // The block the editor is on stays: it was laid outside the history, as `loadTake` lays it.
      expect(laidAssetIds()).toEqual(['asset-1'])
    })

    it('undoes the chain first, leaving the montage where it stands', async () => {
      await openTake()
      const clip = makeClip({
        id: 'clip-2',
        assetId: 'asset-a',
        start: 5 * SECOND,
        duration: SECOND,
      })
      useSequences.getState().runCommand('doc-1', addClip('A1', clip))
      await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      expect(editsOf().edits).toEqual([])
      expect(laidAssetIds()).toEqual(['asset-1', 'asset-a'])
    })
  })

  // The take under the editor and the clip on the strip are two views of one thing.
  describe('the clip it keeps in step', () => {
    /** A document whose take is laid on the strip and selected, as `loadTake` leaves it. */
    async function openLaidTake(): Promise<void> {
      montageWithTake()
      useAudioEdits.setState({ states: { 'doc-1': EMPTY_AUDIO_EDIT }, histories: {} })
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

      writeChain({ region: { from: 0, to: 500_000 } })
      await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

      await waitFor(() => expect(takeClip()?.duration).toBe(CROPPED))
    })

    /**
     * The crop went on the MONTAGE's stack, being a montage gesture, and `AudioDocument` sends
     * ⌘Z there once the chain has nothing left to give back. Anywhere else and the block would
     * keep a length the editor no longer plays — the two halves saying different things about
     * one take, which is the very thing this pair exists to stop.
     */
    it('gives the block its length back when the crop is undone', async () => {
      await openLaidTake()
      writeChain({ region: { from: 0, to: 500_000 } })
      await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))
      await waitFor(() => expect(takeClip()?.duration).toBe(CROPPED))

      await userEvent.keyboard('{Meta>}{z}{/Meta}')

      await waitFor(() => expect(takeClip()?.duration).toBe(2_000_000))
    })

    /**
     * "Apply" writes the slice INTO a file of its own, so the block has to be laid flat over it:
     * it carries the ramps and the level too, and a block left describing them plays them a
     * second time over bytes that already hold them — six decibels above what the editor sounds
     * like, or a block pointing into a file that starts where the block does.
     */
    it('lays the block flat over the file apply wrote', async () => {
      await openLaidTake()
      writeChain({ region: { from: 0, to: 500_000 } })
      await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))
      await waitFor(() => expect(takeClip()?.duration).toBe(CROPPED))
      saveAudio.mockResolvedValueOnce({ ...asset, id: 'asset-2' })

      await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))

      await waitFor(() => expect(takeClip()?.assetId).toBe('asset-2'))
      // The new file IS the slice, so the block spans the whole of it from its first sample.
      expect(takeClip()?.inPoint).toBe(0)
      expect(takeClip()?.duration).toBe(CROPPED)
    })

    /**
     * Dragging a region writes an entry into `chains` — a region is where one is LOOKING, and it
     * has to be remembered. Read as "the tools own this block", that entry let an empty chain
     * project no ramp and no level onto a clip that carried both from the strip: one drag on the
     * wave, and a fade laid by hand was gone. `touched` is what answers that question now.
     */
    it('leaves a hand-laid fade alone when the wave is merely dragged over', async () => {
      await openLaidTake()
      useSequences.setState(state => ({
        states: {
          ...state.states,
          'doc-1': updateClip(sequenceOf(state, 'doc-1'), CLIP, clip => ({
            ...clip,
            fadeIn: 300_000,
            gain: -4,
          })),
        },
      }))

      writeChain({ region: { from: 0, to: 500_000 } })

      await waitFor(() => expect(editsOf().region).not.toBeNull())
      expect(takeClip()?.fadeIn).toBe(300_000)
      expect(takeClip()?.gain).toBe(-4)
    })

    /**
     * Two blocks of the SAME take — a split, or the same sound laid down twice — and the render
     * in hand belongs to whichever was selected a moment ago. Tagged by asset alone, the answer
     * for one was written onto the other the instant the selection moved: same asset, so it read
     * as current. It settles there, too, because the write moves the bounds the next render is
     * asked for.
     */
    it('never writes one block’s shape onto its neighbour on the same take', async () => {
      await openLaidTake()
      const second = makeClip({
        id: 'clip-2',
        assetId: 'asset-1',
        start: 3 * SECOND,
        duration: SECOND,
      })
      useSequences.getState().runCommand('doc-1', addClip('A1', second))
      // Both tooled, so neither is held back by `touched`.
      useAudioEdits.getState().runCommand('doc-1', pushEdit(CLIP, { kind: 'gain', db: -3 }))
      useAudioEdits.getState().runCommand('doc-1', pushEdit('clip-2', { kind: 'gain', db: -3 }))

      useSequences.setState(state => ({
        states: {
          ...state.states,
          'doc-1': { ...sequenceOf(state, 'doc-1'), selectedId: 'clip-2' },
        },
      }))

      await waitFor(() => expect(editsOf('clip-2').edits).toHaveLength(1))
      const moved = sequenceOf(useSequences.getState(), 'doc-1').tracks[0]?.clips.find(
        one => one.id === 'clip-2',
      )
      expect(moved?.start).toBe(3 * SECOND)
      expect(moved?.duration).toBe(SECOND)
    })

    /**
     * A bypassed render is asked for an EMPTY chain, so the shape that comes back is the whole
     * untouched take. Written down, one press of A/B would stretch the clip back to the source —
     * turning a listening aid into an edit of the montage.
     */
    it('leaves the clip alone while A/B is held on the source', async () => {
      await openLaidTake()
      writeChain({ region: { from: 0, to: 500_000 } })
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
      writeChain({ region: { from: 0, to: 500_000 } })
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

  /**
   * The pair is stacked here, so the divider sets a HEIGHT — and it is the montage above that
   * keeps it. `useSplitPair` is tested on its own arithmetic; this is the only thing that says
   * its answer landed on the right box of this tab, on the right axis.
   */
  it('gives the montage a height of its own once the divider is dragged', async () => {
    await openTake()
    const divider = screen.getByRole('separator', { hidden: true })

    fireEvent.pointerDown(divider, { pointerId: 1, clientY: 400 })
    fireEvent.pointerMove(divider, { pointerId: 1, clientY: 200 })

    const montage = screen.getByText(/Le montage entier/).closest('section')?.parentElement
    expect(montage?.style.height).not.toBe('')
    expect(montage?.style.width).toBe('')
  })

  // A montage with nothing selected: the editor below has no block to show, and says which
  // gesture would give it one rather than looking broken.
  it('asks for a selection when no block is picked', () => {
    render(<AudioDocument documentId="doc-1" />)
    expect(screen.getByText(/Sélectionnez un clip du montage/)).toBeInTheDocument()
  })

  it('appends a step rather than rewriting the take', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Normaliser/ }))

    expect(editsOf().edits).toEqual([{ kind: 'normalize', targetLufs: -14 }])
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(true)
  })

  /**
   * The two tools that CUT land on the block's bounds and leave the chain empty, cutting being
   * a montage gesture wherever it is made from. As a STEP, each was replayed over the slice it
   * had just produced and ate into it again on every render.
   */
  it('trims the block to what is not silence at its two ends', async () => {
    const quiet = new Float32Array(200)
    quiet.fill(0.5, 50, 150)
    decodeAsset.mockResolvedValueOnce({ sampleRate: 100, channels: [quiet] })
    await openTake()

    await userEvent.click(screen.getByRole('button', { name: /Couper les silences/ }))

    await waitFor(() => expect(takeClip()?.inPoint).toBe(500_000))
    expect(takeClip()?.duration).toBe(1_000_000)
    expect(editsOf().edits).toEqual([])
  })

  it('refuses to crop with nothing selected, rather than emptying the take', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

    expect(takeClip()?.duration).toBe(2 * SECOND)
  })

  it('crops the block to the selected region', async () => {
    await openTake()
    writeChain({ region: { from: 0, to: 500_000 } })

    await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

    // 13 frames at 25 fps rather than the 12.5 asked for: a block lands on the frame grid,
    // exactly as one laid down by hand does.
    await waitFor(() => expect(takeClip()?.duration).toBe(520_000))
    expect(editsOf().edits).toEqual([])
  })

  /**
   * Cutting says nothing about a level, and only `clampFades` may say what is left of a ramp.
   * Written from the SLICE — where both are zero by construction — a crop wiped what a hand had
   * laid on the strip, which is the very defect the slice was introduced to stop.
   */
  it('leaves the block its ramps and its level when it crops', async () => {
    await openTake()
    useSequences.setState(state => ({
      states: {
        ...state.states,
        'doc-1': updateClip(sequenceOf(state, 'doc-1'), CLIP, clip => ({
          ...clip,
          fadeIn: 200_000,
          gain: -4,
        })),
      },
    }))
    writeChain({ region: { from: 0, to: 500_000 } })

    await userEvent.click(screen.getByRole('button', { name: /Rogner/ }))

    await waitFor(() => expect(takeClip()?.duration).toBe(520_000))
    expect(takeClip()?.fadeIn).toBe(200_000)
    expect(takeClip()?.gain).toBe(-4)
  })

  it('keeps A/B off the undo stack: it changes what is heard, not what was done', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /A\/B/ }))

    expect(editsOf().bypassed).toBe(true)
    expect(canUndo(audioHistoryOf(useAudioEdits.getState(), 'doc-1'))).toBe(false)
  })

  /**
   * A take is one asset behind however many blocks — in this montage and in every other document
   * open on the project. "Apply" used to replace it under its own id, which moved all of them at
   * once, silently, to bytes only this block had asked for.
   */
  it('writes beside the source on apply, never over it', async () => {
    await openTake()
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))

    await waitFor(() => expect(saveAudio).toHaveBeenCalled())
    expect(saveAudio.mock.calls[0]?.[0]).toEqual(
      expect.not.objectContaining({ replaces: expect.anything() }),
    )
    expect(saveAudio.mock.calls[0]?.[0]).toMatchObject({
      derivedFrom: 'asset-1',
      name: 'pad.wav (édité)',
    })
  })

  it('points the block at what apply wrote', async () => {
    await openTake()
    saveAudio.mockResolvedValueOnce({ ...asset, id: 'asset-2' })

    await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))

    await waitFor(() => expect(laidAssetIds()).toEqual(['asset-2']))
  })

  /**
   * Which take a block plays is held by the MONTAGE and by nothing else — the chain that asked
   * for it is dropped by the same button. Left unmarked, ⌘W closes the tab without asking and the
   * block reopens on the original take, brut: the whole edit gone, and the derived file orphaned.
   */
  it('leaves work to save once apply has repointed the block', async () => {
    await openTake()
    const clean = useSequences.getState()
    clean.markSaved('doc-1', sequenceStore.markOf(clean, 'doc-1'))
    saveAudio.mockResolvedValueOnce({ ...asset, id: 'asset-2' })

    await userEvent.click(screen.getByRole('button', { name: /Appliquer/ }))

    await waitFor(() => expect(laidAssetIds()).toEqual(['asset-2']))
    expect(sequenceStore.hasUnsavedWork(useSequences.getState(), 'doc-1')).toBe(true)
  })

  // The difference between the two buttons, and the whole of it: one moves the montage on, the
  // other only adds to the shelf.
  it('writes beside the source on save as, and leaves the montage where it was', async () => {
    await openTake()
    saveAudio.mockResolvedValueOnce({ ...asset, id: 'asset-2' })

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer comme nouveau/ }))

    await waitFor(() => expect(saveAudio).toHaveBeenCalled())
    expect(saveAudio.mock.calls[0]?.[0]).toMatchObject({
      derivedFrom: 'asset-1',
      name: 'pad.wav (édité)',
    })
    expect(laidAssetIds()).toEqual(['asset-1'])
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

    // The block stays where it is, holding the take it always held: what was emptied is its
    // chain, not the montage under it.
    expect(laidAssetIds()).toEqual(['asset-1'])
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
    return (
      screen.getByText(/Sélectionnez un clip du montage/).closest('div[class]') ?? document.body
    )
  }

  // The montage too, and not only the chain: a block left selected by the suite above is a
  // block the editor would show, and this one is about the editor with nothing in it.
  beforeEach(() => {
    useAudioEdits.setState({ states: {}, histories: {} })
    useSequences.setState({ states: { 'doc-1': EMPTY_SOUND_SEQUENCE }, histories: {} })
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

    // A block, and the selection that puts it under the editor: dropping on the editor is the
    // gesture, laying it on the montage is what the gesture now means.
    expect(laidAssetIds()).toEqual(['asset-1'])
    expect(sequenceOf(useSequences.getState(), 'doc-1').selectedId).not.toBeNull()
  })

  // A tab that only says "undecodable" is a dead end: the gesture that would replace the take
  // is the very one it stopped accepting.
  it('still takes a drop once the take it holds turned out to be undecodable', async () => {
    decodeAsset.mockRejectedValueOnce(new Error('not audio'))
    useAssets.setState({ items: [asset, { ...asset, id: 'asset-2', name: 'other.wav' }] })
    montageWithTake()

    render(<AudioDocument documentId="doc-1" />)
    const dead = await screen.findByText(/n’a pas pu être décodé/)

    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-2', type: 'audio' })
    fireEvent.drop(dead.closest('div[class]') ?? document.body, { dataTransfer })
    await Promise.resolve()

    // Laid over the block the head stands on, which is the one that would not decode.
    expect(laidAssetIds()).toEqual(['asset-2'])
  })

  it('refuses a picture, which the editor has nothing to do with', () => {
    useAssets.setState({ items: [{ ...asset, id: 'asset-pic', type: 'image' }] })
    const dataTransfer = dragTransfer()
    startAssetDrag({ dataTransfer }, { id: 'asset-pic', type: 'image' })

    // A refused drag is one the browser never lets land: `preventDefault` is not called.
    expect(fireEvent.dragOver(emptyEditor(), { dataTransfer })).toBe(true)
  })
})
