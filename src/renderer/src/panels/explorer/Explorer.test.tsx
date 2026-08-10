import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Explorer } from './Explorer'

const openDocument = vi.fn()
vi.mock('@/app/dockview-api', () => ({
  openDocument: (...args: unknown[]) => openDocument(...args),
}))

const scene: DocumentDescriptor = { id: 'doc-1', kind: 'scene', title: 'Niveau', workspace: '3d' }
const sequence: DocumentDescriptor = {
  id: 'doc-2',
  kind: 'sequence',
  title: 'Bande annonce',
  workspace: 'video',
}

const withProject = (): void => {
  useProject.setState({
    project: {
      path: '/projects/demo',
      manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useProject.setState({ project: null })
  useLayouts.setState({ layouts: {} })
  installFakeBridge({})
})

describe('the project explorer', () => {
  it('says so when no project is open, rather than listing nothing', () => {
    render(<Explorer />)
    expect(screen.getByText(/Aucun projet ouvert/)).toBeInTheDocument()
  })

  /**
   * The panel is on screen in every workspace, and until it carried these two the only way to
   * fill it was a trip back to the home — which is also the only place the two gestures live.
   */
  describe('with no project open', () => {
    it('offers both ways out of an empty studio', () => {
      render(<Explorer />)

      expect(screen.getByRole('button', { name: 'Ouvrir un projet' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Créer un projet' })).toBeInTheDocument()
    })

    it('picks a folder to open', async () => {
      const openPicked = vi.fn(() => Promise.resolve())
      useProject.setState({ openPicked })

      render(<Explorer />)
      await userEvent.click(screen.getByRole('button', { name: 'Ouvrir un projet' }))

      expect(openPicked).toHaveBeenCalled()
    })

    it('picks a folder to create one in', async () => {
      const createPicked = vi.fn(() => Promise.resolve())
      useProject.setState({ createPicked })

      render(<Explorer />)
      await userEvent.click(screen.getByRole('button', { name: 'Créer un projet' }))

      expect(createPicked).toHaveBeenCalled()
    })
  })

  it('lists what the project folder holds', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([scene, sequence]) } })

    render(<Explorer />)

    expect(await screen.findByText('Bande annonce')).toBeInTheDocument()
    expect(screen.getByText('Niveau')).toBeInTheDocument()
  })

  // The whole point of the panel: a document closed while no layout held it is unreachable
  // otherwise, and it is exactly the one being hunted.
  it('lists a document no tab is showing', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([scene]) } })

    render(<Explorer />)

    expect(await screen.findByText('Niveau')).toBeInTheDocument()
    expect(useDocuments.getState().documents['doc-1']).toBeUndefined()
  })

  it('marks the documents a tab is already showing', async () => {
    withProject()
    useDocuments.setState({ documents: { 'doc-1': scene } })
    installFakeBridge({ documents: { list: () => Promise.resolve([scene, sequence]) } })

    render(<Explorer />)

    await screen.findByText('Niveau')
    expect(screen.getAllByText('Ouvert')).toHaveLength(1)
  })

  /**
   * "Open" used to borrow `selectedIds`, which painted the selection tint on rows nobody had
   * chosen — while Styles and Apps, which do have a selection, showed none. The mark is the
   * row's own now, and it must not be the tint.
   */
  it('marks an open document without borrowing the selection tint', async () => {
    withProject()
    useDocuments.setState({ documents: { 'doc-1': scene } })
    installFakeBridge({ documents: { list: () => Promise.resolve([scene, sequence]) } })

    const { container } = render(<Explorer />)

    await screen.findByText('Niveau')
    expect(container.querySelector('.bg-accent-soft')).toBeNull()
    // The dot, drawn for the open one and not for the other.
    expect(container.querySelectorAll('.bg-accent')).toHaveLength(1)
  })

  /**
   * `create` posts a descriptor without writing a file — deliberately, so a tab opened and never
   * typed in leaves nothing in the project. Reading the folder must therefore never settle which
   * tabs are open, or opening this panel would evict that document while its tab is on screen,
   * and the tab would fall back to "no longer open" with its state orphaned.
   */
  it('leaves a document that has no file yet alone', async () => {
    withProject()
    const unwritten: DocumentDescriptor = {
      id: 'doc-new',
      kind: 'image',
      title: 'Sans titre 1',
      workspace: 'image',
    }
    useDocuments.setState({ documents: { 'doc-new': unwritten } })
    installFakeBridge({ documents: { list: () => Promise.resolve([scene]) } })

    render(<Explorer />)

    await screen.findByText('Niveau')
    expect(useDocuments.getState().documents['doc-new']).toBe(unwritten)
  })

  it('opens a document on a double-click', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([sequence]) } })

    render(<Explorer />)
    await userEvent.dblClick(await screen.findByText('Bande annonce'))

    expect(openDocument).toHaveBeenCalledWith(sequence)
  })

  // No keyboard could reach these rows: the collection made a row reachable only when it was
  // selectable, and "open" is not a selection.
  it('opens a document from the keyboard', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([sequence]) } })

    render(<Explorer />)
    await screen.findByText('Bande annonce')
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(openDocument).toHaveBeenCalledWith(sequence)
  })

  // "Open" is not "selected": the row says it in words, and a state the user can neither set
  // nor clear from this panel has no business being announced as one they picked.
  it('lists its documents without claiming any of them is selected', async () => {
    withProject()
    useDocuments.setState({ documents: { 'doc-1': scene } })
    installFakeBridge({ documents: { list: () => Promise.resolve([scene]) } })

    render(<Explorer />)

    await screen.findByText('Niveau')
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).not.toHaveAttribute('aria-selected')
  })

  it('says the project is empty rather than showing a blank panel', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([]) } })

    render(<Explorer />)
    expect(await screen.findByText(/aucun document/)).toBeInTheDocument()
  })
})
