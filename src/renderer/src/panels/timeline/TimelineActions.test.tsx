import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { addClip } from '@/engines/timeline/commands'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import { DEFAULT_VIDEO_TOOL } from '@/spaces/video/video-tools'
import { useDocuments } from '@/stores/documents'
import { installSequence } from '@/stores/sequence-fixtures'
import { useSequences } from '@/stores/sequences'
import { useVideoTool } from '@/stores/video-tool'
import { TimelineActions } from './TimelineActions'

const clip = clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' })

describe('TimelineActions', () => {
  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
    useVideoTool.setState({ tool: DEFAULT_VIDEO_TOOL })
    useDocuments.setState({ documents: {}, activeId: null })
  })

  it('renders no action while no document is active', () => {
    const view = render(<TimelineActions />)
    expect(view.container).toBeEmptyDOMElement()
  })

  it('offers the montage tools in the panel title bar', () => {
    installSequence('doc-1')
    render(<TimelineActions />)

    expect(screen.getByRole('button', { name: /Sélection/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lame/ })).toBeInTheDocument()
  })

  it('arms the tool the bar picks', async () => {
    installSequence('doc-1')
    render(<TimelineActions />)

    await userEvent.click(screen.getByRole('button', { name: /Lame/ }))

    expect(useVideoTool.getState().tool).toBe('blade')
  })

  // The Edit menu carries `sequence.undo`; a second pair on the title bar said otherwise.
  it('draws no history of its own', () => {
    installSequence('doc-1')
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    render(<TimelineActions />)

    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
  })
})
