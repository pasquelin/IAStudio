import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_TOOL } from '@/spaces/video/video-tools'
import { useDocuments } from '@/stores/documents'
import { installSequence } from '@/stores/sequence-fixtures'
import { useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/video-tool'
import { TimelinePanel } from './TimelinePanel'

describe('TimelinePanel', () => {
  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
    useVideoTool.setState({ tool: DEFAULT_VIDEO_TOOL })
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
    useDocuments.setState({
      documents: { 'doc-1': { id: 'doc-1', kind: 'image', workspace: 'image', title: 'doc-1' } },
      activeId: 'doc-1',
    })
    render(<TimelinePanel />)

    expect(screen.getByText(/Aucune séquence ouverte/)).toBeInTheDocument()
  })
})
