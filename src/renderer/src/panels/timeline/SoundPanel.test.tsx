import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { addClip } from '@/engines/timeline/commands'
import { makeClip } from '@/engines/timeline/timeline-state'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView } from '@/stores/timeline-view'
import { TimelinePanel } from './TimelinePanel'

const DOCUMENT = 'take-1'

const tracksOf = () => sequenceOf(useSequences.getState(), DOCUMENT).tracks

describe('the sound montage of a take', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useSequences.setState({ states: {}, histories: {} })
    useTimelineView.setState({ viewports: {} })
  })

  it('shows a montage for the take in front, where the panel used to say nothing was open', () => {
    installDocument(DOCUMENT, 'audio')
    const view = render(<TimelinePanel />)

    expect(screen.queryByText(/Aucune séquence ouverte/)).not.toBeInTheDocument()
    expect(view.container.querySelector('canvas')).toBeInTheDocument()
  })

  it('opens on sound tracks only: there is no monitor here to show a picture on', () => {
    installDocument(DOCUMENT, 'audio')
    render(<TimelinePanel />)

    expect(tracksOf().map(track => track.kind)).toEqual(['audio', 'audio', 'audio', 'audio'])
  })

  // The trap this repository names outright: two undo stacks answering one ⌘Z. The take listens
  // on the `audio` scope; a strip listening on `sequence` beside it would undo both at once — so
  // the strip stays silent here, and `AudioDocument` routes the key to the right half.
  it('leaves the sequence scope to the take, so one ⌘Z cannot undo two things', () => {
    installDocument(DOCUMENT, 'audio')
    render(<TimelinePanel />)

    const clip = makeClip({ id: 'clip-1', assetId: 'asset-a', start: 0, duration: SECOND })
    useSequences.getState().runCommand(DOCUMENT, addClip('A1', clip))
    fireEvent.keyDown(window, { key: 'z', metaKey: true, code: 'KeyZ' })

    expect(tracksOf()[0]?.clips).toHaveLength(1)
  })

  it('leaves a montage already open alone, so reopening the tab is not a reset', () => {
    installDocument(DOCUMENT, 'audio')
    render(<TimelinePanel />)
    useSequences.getState().replace(DOCUMENT, {
      ...sequenceOf(useSequences.getState(), DOCUMENT),
      playhead: 42,
    })

    render(<TimelinePanel />)

    expect(sequenceOf(useSequences.getState(), DOCUMENT).playhead).toBe(42)
  })
})
