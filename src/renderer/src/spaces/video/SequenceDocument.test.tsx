import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { addClip } from '@/engines/timeline/commands'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import type { SequenceState } from '@/engines/timeline/timeline-state'
import { TimelinePanel } from '@/panels/timeline/TimelinePanel'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useSequences } from '@/stores/sequences'
import { SequenceDocument } from './SequenceDocument'

const play = vi.fn()
const pause = vi.fn()
// Shared across instances, unlike the per-engine mocks: what the engine is handed is what will be
// painted and heard, and both monitors hand it over here.
const applied = vi.fn<(state: SequenceState) => void>()

// jsdom has neither WebGL nor WebCodecs: the engine is exercised by hand, not here. What this
// covers is that the tab shows two monitors and wires their transport.
vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    mount = vi.fn(() => Promise.resolve())
    apply = applied
    seek = vi.fn(() => Promise.resolve())
    play = play
    pause = pause
    playing = vi.fn(() => false)
    openSinks = vi.fn(() => 0)
    dispose = vi.fn()
  },
}))

const clip = clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' })

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

/** The source monitor's track, as the engine last received it — 'S1' is its only one. */
const sourceTrack = () =>
  applied.mock.calls
    .map(([state]) => state.tracks.find(track => track.id === 'S1'))
    .filter(Boolean)
    .at(-1)

describe('SequenceDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSequences.setState({ states: {}, histories: {} })
    useDocuments.setState({ activeId: 'doc-1' })
    useAssets.setState({ items: [] })
  })

  it('shows the source and the program monitors, in that order', () => {
    render(<SequenceDocument documentId="doc-1" />)

    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Programme')).toBeInTheDocument()
  })

  it('gives each monitor its own transport', () => {
    render(<SequenceDocument documentId="doc-1" />)
    expect(screen.getAllByRole('button', { name: /Lire/ })).toHaveLength(2)
  })

  it('answers the space bar once when the montage strip is open beside the monitors', async () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    render(
      <>
        <SequenceDocument documentId="doc-1" />
        <TimelinePanel />
      </>,
    )
    await userEvent.keyboard(' ')

    // Both surfaces listen on the `sequence` scope and drive the same transport by name. When
    // both handled the key, one started the programme monitor and the other stopped it.
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('shows a timecode for each monitor', () => {
    render(<SequenceDocument documentId="doc-1" />)
    expect(screen.getAllByText('00:00:00:00')).toHaveLength(2)
  })

  it('invites the user to pick a clip while the source monitor has none', () => {
    render(<SequenceDocument documentId="doc-1" />)
    expect(screen.getByText(/Sélectionnez un clip/)).toBeInTheDocument()
  })

  it('drops the invitation once a clip is selected', () => {
    render(<SequenceDocument documentId="doc-1" />)
    act(() => useSequences.getState().runCommand('doc-1', addClip('V1', clip)))

    expect(screen.queryByText(/Sélectionnez un clip/)).not.toBeInTheDocument()
  })

  /**
   * The monitor used to mount whatever was selected on a picture track. A take landed there is
   * shown as a black frame and heard as nothing at all — `audioChunksIn` only schedules tracks of
   * the sound kind.
   */
  it('mounts a sound asset on a sound track, so the source monitor is heard', () => {
    useAssets.setState({ items: [asset()] })
    render(<SequenceDocument documentId="doc-1" />)

    act(() => useSequences.getState().runCommand('doc-1', addClip('A1', clip)))

    expect(sourceTrack()?.kind).toBe('audio')
  })

  it('leaves a picture asset on a picture track', () => {
    useAssets.setState({ items: [asset({ type: 'video' })] })
    render(<SequenceDocument documentId="doc-1" />)

    act(() => useSequences.getState().runCommand('doc-1', addClip('V1', clip)))

    expect(sourceTrack()?.kind).toBe('video')
  })

  // A clip whose asset left the catalogue: shown as a missing media, not silently made audio.
  it('falls back to a picture track when the asset is unknown', () => {
    render(<SequenceDocument documentId="doc-1" />)

    act(() => useSequences.getState().runCommand('doc-1', addClip('V1', clip)))

    expect(sourceTrack()?.kind).toBe('video')
  })

  it('starts the program monitor when its play button is pressed', () => {
    render(<SequenceDocument documentId="doc-1" />)

    screen.getAllByRole('button', { name: /Lire/ })[1]?.click()

    expect(play).toHaveBeenCalledTimes(1)
  })

  it('starts the program monitor on the space bar, which its tooltip promises', () => {
    render(<SequenceDocument documentId="doc-1" />)

    fireEvent.keyDown(window, { code: 'Space' })

    expect(play).toHaveBeenCalledTimes(1)
  })

  it('leaves the space bar to the tab in front, since hidden tabs stay mounted', () => {
    useDocuments.setState({ activeId: 'doc-2' })
    render(<SequenceDocument documentId="doc-1" />)

    fireEvent.keyDown(window, { code: 'Space' })

    expect(play).not.toHaveBeenCalled()
  })

  it('leaves the source monitor to its button, so one space bar drives one picture', () => {
    render(<SequenceDocument documentId="doc-1" />)

    const names = screen
      .getAllByRole('button', { name: /Lire/ })
      .map(button => button.getAttribute('aria-label'))

    // The key is named from the bundle: the French interface used to announce `Space`.
    expect(names).toEqual(['Lire', 'Lire (Espace)'])
  })
})
