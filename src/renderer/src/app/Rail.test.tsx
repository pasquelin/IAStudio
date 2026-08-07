import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Rail } from './Rail'

const openDocument = vi.fn()
vi.mock('./DocumentArea', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

describe('Rail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeBridge()
    useDocuments.setState({ documents: {} })
    useLayouts.setState({ activeWorkspace: '3d', layouts: {} })
    const stamp = '2026-08-07T10:00:00.000Z'
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'One', createdAt: stamp, updatedAt: stamp },
      },
    })
  })

  it('creates a document in the active workspace and opens it', async () => {
    render(<Rail side="left" />)
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau document' }))

    // The document is written before it is announced, so the tab arrives a turn later.
    await waitFor(() => expect(Object.keys(useDocuments.getState().documents)).toHaveLength(1))

    const documents = Object.values(useDocuments.getState().documents)
    expect(documents[0]?.workspace).toBe('3d')
    expect(openDocument).toHaveBeenCalledWith(documents[0])
  })

  // A document is a file in a project folder: with none open there is nowhere to write it, and
  // the click would fail after the fact rather than never being offered.
  it('disables the button while no project is open', () => {
    useProject.setState({ project: null })
    render(<Rail side="left" />)
    expect(screen.getByRole('button', { name: 'Nouveau document' })).toBeDisabled()
  })

  it('carries no new-document button on the right rail', () => {
    render(<Rail side="right" />)
    expect(screen.queryByRole('button', { name: 'Nouveau document' })).not.toBeInTheDocument()
  })
})
