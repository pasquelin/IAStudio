import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
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
