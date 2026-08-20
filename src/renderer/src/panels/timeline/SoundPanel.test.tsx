import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { addClip } from '@/engines/timeline/commands'
import { EMPTY_SOUND_SEQUENCE, makeClip } from '@/engines/timeline/timelineState'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView } from '@/stores/timelineView'
import { TimelinePanel } from './TimelinePanel'

const DOCUMENT = 'take-1'

const tracksOf = () => sequenceOf(useSequences.getState(), DOCUMENT).tracks

/** What `documentIo` installs when a take is opened — the panel itself installs nothing. */
function openTake(): void {
  installDocument(DOCUMENT, 'audio')
  useSequences.getState().ensure(DOCUMENT, () => EMPTY_SOUND_SEQUENCE)
}

describe('the sound montage of a take', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useTimelineView.setState({ viewports: {} })
  })

  it('shows a montage for the take in front, where the panel used to say nothing was open', () => {
    openTake()
    const view = render(<TimelinePanel />)

    expect(screen.queryByText(/Aucune séquence ouverte/)).not.toBeInTheDocument()
    expect(view.container.querySelector('canvas')).toBeInTheDocument()
  })

  it('opens on sound tracks only: there is no monitor here to show a picture on', () => {
    openTake()
    render(<TimelinePanel />)

    expect(tracksOf().map(track => track.kind)).toEqual(['audio', 'audio', 'audio', 'audio'])
  })

  /**
   * Nothing at all until the document is filled, and that is the point: the montage store answers
   * with the SEQUENCE default — which carries a picture track — for any id it has never seen. A
   * panel installing its own default beside `documentIo` would show that montage while the file
   * was still in flight, and the read landing after would replace whatever had been dropped on it.
   */
  it('shows nothing until the document itself is installed', () => {
    installDocument(DOCUMENT, 'audio')
    const view = render(<TimelinePanel />)

    expect(view.container.querySelector('canvas')).not.toBeInTheDocument()
    expect(useSequences.getState().states[DOCUMENT]).toBeUndefined()
  })

  // The trap this repository names outright: two undo stacks answering one ⌘Z. The take listens
  // on the `audio` scope; a strip undoing on `sequence` beside it would take a step off both.
  it('leaves undo to the take, so one ⌘Z cannot undo two things', () => {
    openTake()
    render(<TimelinePanel />)

    const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: SECOND })
    useSequences.getState().runCommand(DOCUMENT, addClip('A1', clip))
    fireEvent.keyDown(window, { key: 'z', metaKey: true, code: 'KeyZ' })

    expect(tracksOf()[0]?.clips).toHaveLength(1)
  })

  // Only undo and redo are given up. The rest of the strip's keyboard stays live, or the one
  // timeline this lot exists to make consistent would be the only one that answers nothing.
  it('still answers the keys the strip binds for itself', () => {
    openTake()
    render(<TimelinePanel />)

    const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: SECOND })
    useSequences.getState().runCommand(DOCUMENT, addClip('A1', clip))
    useSequences.getState().replace(DOCUMENT, {
      ...sequenceOf(useSequences.getState(), DOCUMENT),
      selectedId: 'clip-1',
    })

    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' })

    expect(tracksOf()[0]?.clips).toEqual([])
  })
})
