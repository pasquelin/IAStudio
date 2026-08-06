import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { Rail } from './Rail'

const openDocument = vi.fn()
vi.mock('./DocumentArea', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

describe('Rail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDocuments.setState({ documents: {} })
    useLayouts.setState({ activeWorkspace: '3d', layouts: {} })
  })

  it('creates a document in the active workspace and opens it', async () => {
    render(<Rail side="left" />)
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau document' }))

    const documents = Object.values(useDocuments.getState().documents)
    expect(documents).toHaveLength(1)
    expect(documents[0]?.workspace).toBe('3d')
    expect(openDocument).toHaveBeenCalledWith(documents[0])
  })

  it('disables the button in a workspace without an editor', () => {
    useLayouts.setState({ activeWorkspace: 'audio' })
    render(<Rail side="left" />)
    expect(screen.getByRole('button', { name: 'Nouveau document' })).toBeDisabled()
  })

  it('carries no new-document button on the right rail', () => {
    render(<Rail side="right" />)
    expect(screen.queryByRole('button', { name: 'Nouveau document' })).not.toBeInTheDocument()
  })
})
