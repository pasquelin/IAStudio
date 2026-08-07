import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addClip } from '@/engines/timeline/commands'
import type { Clip } from '@/engines/timeline/timeline-state'
import { DEFAULT_VIDEO_TOOL } from '@/spaces/video/video-tools'
import { useDocuments } from '@/stores/documents'
import { useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/video-tool'
import { TimelineActions, TimelinePanel } from './TimelinePanel'

const clip: Clip = {
  id: 'clip-1',
  assetId: 'asset-1',
  start: 0,
  duration: 1_000_000,
  inPoint: 0,
  speed: 1,
}

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
    useDocuments.setState({ activeId: 'doc-1' })
    const view = render(<TimelinePanel />)
    expect(view.container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders no action while no document is active', () => {
    const view = render(<TimelineActions />)
    expect(view.container).toBeEmptyDOMElement()
  })

  it('offers the montage tools in the panel title bar', () => {
    useDocuments.setState({ activeId: 'doc-1' })
    render(<TimelineActions />)

    expect(screen.getByRole('button', { name: /Sélection/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lame/ })).toBeInTheDocument()
  })

  it('arms the tool the bar picks', async () => {
    useDocuments.setState({ activeId: 'doc-1' })
    render(<TimelineActions />)

    await userEvent.click(screen.getByRole('button', { name: /Lame/ }))

    expect(useVideoTool.getState().tool).toBe('blade')
  })

  it('enables undo once the sequence in front has been edited', () => {
    useDocuments.setState({ activeId: 'doc-1' })
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    render(<TimelineActions />)

    expect(screen.getByRole('button', { name: /Annuler/ })).toBeEnabled()
  })
})
