import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { RailNewButton } from './RailNewButton'

const openDocument = vi.fn()
vi.mock('./dockviewApi', () => ({ openDocument: (...args: unknown[]) => openDocument(...args) }))

/**
 * The button pinned above the left rail's icons. It kept its only coverage inside the rail's own
 * suite until the chassis moved into `@pasquelin/panels` and took that suite with it — the rail
 * was never what these cases were about.
 */
describe('RailNewButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeBridge()
    useDocuments.setState({ documents: {} })
    useLayouts.setState({ activeWorkspace: '3d', home: false, layout: null })
    const stamp = '2026-08-07T10:00:00.000Z'
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, createdAt: stamp, updatedAt: stamp },
      },
    })
  })

  it('creates a document in the active workspace and opens it', async () => {
    // The naming window answers, which is what a person in front of it would do: the default
    // bridge answers `null`, and cancelling makes nothing at all.
    installFakeBridge({
      newDocument: { ask: () => Promise.resolve({ title: 'Niveau', folder: 'documents' }) },
    })
    render(<RailNewButton />)
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
    render(<RailNewButton />)

    expect(screen.getByRole('button', { name: 'Nouveau document' })).toBeDisabled()
  })

  /**
   * The button makes what the surface makes. On the home a document would land in the space
   * behind it, out of sight of the screen that was asked — and the project is what the studio
   * needs first anyway, which is why the button must not be dead there.
   */
  describe('on the home', () => {
    beforeEach(() => {
      useLayouts.setState({ home: true })
    })

    it('offers a new project instead of a new document', () => {
      render(<RailNewButton />)

      expect(screen.getByRole('button', { name: 'Nouveau projet' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nouveau document' })).not.toBeInTheDocument()
    })

    it('stays clickable with no project open — creating one needs no project', async () => {
      const createPicked = vi.fn(() => Promise.resolve())
      useProject.setState({ project: null, createPicked })
      render(<RailNewButton />)

      const button = screen.getByRole('button', { name: 'Nouveau projet' })
      expect(button).not.toBeDisabled()

      await userEvent.click(button)
      expect(createPicked).toHaveBeenCalled()
    })
  })
})
