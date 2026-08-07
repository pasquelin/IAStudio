import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addClip } from '@/engines/timeline/commands'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import { useDocuments } from '@/stores/documents'
import { useSequences } from '@/stores/sequences'
import { SequenceDocument } from './SequenceDocument'

const play = vi.fn()
const pause = vi.fn()

// jsdom has neither WebGL nor WebCodecs: the engine is exercised by hand, not here. What this
// covers is that the tab shows two monitors and wires their transport.
vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    mount = vi.fn(() => Promise.resolve())
    apply = vi.fn()
    seek = vi.fn(() => Promise.resolve())
    play = play
    pause = pause
    playing = vi.fn(() => false)
    openDecoders = vi.fn(() => 0)
    dispose = vi.fn()
  },
}))

const clip = clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' })

describe('SequenceDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSequences.setState({ states: {}, histories: {} })
    useDocuments.setState({ activeId: 'doc-1' })
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

    expect(names).toEqual(['Lire', 'Lire (Space)'])
  })
})
