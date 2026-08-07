import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addClip } from '@/engines/timeline/commands'
import { useSequences } from '@/stores/sequences'
import { SequenceDocument } from './SequenceDocument'

// jsdom has neither WebGL nor WebCodecs: the engine is exercised by hand, not here. What this
// covers is that the document wires the bar and the history to the right calls.
vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    mount = vi.fn(() => Promise.resolve())
    apply = vi.fn()
    seek = vi.fn(() => Promise.resolve())
    openDecoders = vi.fn(() => 0)
    dispose = vi.fn()
  },
}))

const clip = {
  id: 'a',
  assetId: 'asset-a',
  start: 0,
  duration: 1_000_000,
  inPoint: 0,
  speed: 1,
}

describe('SequenceDocument', () => {
  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
  })

  it('renders the shared toolbar with the video tools', () => {
    render(<SequenceDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Sélection/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lame/ })).toBeInTheDocument()
  })

  it('starts with undo disabled, since nothing has been edited yet', () => {
    render(<SequenceDocument documentId="doc-2" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })

  it('enables undo once a command has run on this document', () => {
    render(<SequenceDocument documentId="doc-3" />)
    act(() => useSequences.getState().runCommand('doc-3', addClip('V1', clip)))
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeEnabled()
  })

  it('keeps histories apart: a command on one document leaves the other untouched', () => {
    useSequences.getState().runCommand('doc-4', addClip('V1', clip))
    render(<SequenceDocument documentId="doc-5" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })
})
