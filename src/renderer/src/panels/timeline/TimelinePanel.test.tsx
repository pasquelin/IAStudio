import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { installCanvas } from '@/stores/canvas-fixtures'
import { useDocuments } from '@/stores/documents'
import { installSequence } from '@/stores/sequence-fixtures'
import { TimelinePanel } from './TimelinePanel'

describe('TimelinePanel', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
  })

  it('says so rather than showing an empty strip when no sequence is open', () => {
    render(<TimelinePanel />)
    expect(screen.getByText(/Aucune séquence ouverte/)).toBeInTheDocument()
  })

  it('paints the timeline of the document in front', () => {
    installSequence('doc-1')
    const view = render(<TimelinePanel />)
    expect(view.container.querySelector('canvas')).toBeInTheDocument()
  })

  // Another kind handed to `useSequences` would give it a montage drawn from the default state.
  it('shows no strip for a document that is not a sequence', () => {
    installCanvas('doc-1')
    render(<TimelinePanel />)

    expect(screen.getByText(/Aucune séquence ouverte/)).toBeInTheDocument()
  })
})
