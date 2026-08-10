import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { FolderEntry } from '@shared/domain/folder'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Explorer } from './Explorer'

const openDocument = vi.fn()
vi.mock('@/app/dockview-api', () => ({
  openDocument: (...args: unknown[]) => openDocument(...args),
}))

const scene: DocumentDescriptor = { id: 'a3f1', kind: 'scene', title: 'Niveau', workspace: '3d' }

const folder = (name: string, at = ''): FolderEntry => ({
  path: at === '' ? name : `${at}/${name}`,
  name,
  kind: 'folder',
})

const file = (name: string, at = ''): FolderEntry => ({
  path: at === '' ? name : `${at}/${name}`,
  name,
  kind: 'file',
})

const withProject = (): void => {
  useProject.setState({
    project: {
      path: '/projects/demo',
      manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
    },
  })
}

/** What the main process answers per folder, so a test says what the disk holds and no more. */
function install(byFolder: Record<string, FolderEntry[]>, documents: DocumentDescriptor[] = []) {
  const listFolder = vi.fn((relative: string) => Promise.resolve(byFolder[relative] ?? []))
  const openFile = vi.fn(() => Promise.resolve(true))
  installFakeBridge({
    project: { listFolder, openFile },
    documents: { list: () => Promise.resolve(documents) },
  })
  return { listFolder, openFile }
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

    // The panel is mounted with no project too, and the window comes back to the front all the
    // same: a read then would ask the main process for the folder of a project nobody opened.
    it('asks the disk for nothing when the window comes back', async () => {
      const { listFolder } = install({ '': [file('one.txt')] })

      render(<Explorer />)
      window.dispatchEvent(new Event('focus'))
      await waitFor(() => expect(screen.getByText(/Aucun projet ouvert/)).toBeInTheDocument())

      expect(listFolder).not.toHaveBeenCalled()
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

  /**
   * The whole point of the change: the panel shows the folder the user owns, not the list of
   * documents the studio can open. What it must not lose is the reason it existed — a document
   * closed while no layout held it is found again here.
   */
  describe('with a project open', () => {
    it('shows the project folder rather than a list of documents', async () => {
      withProject()
      install({ '': [folder('assets'), folder('documents'), file('notes.txt')] })

      render(<Explorer />)

      expect(await screen.findByText('assets')).toBeInTheDocument()
      expect(screen.getByText('documents')).toBeInTheDocument()
      expect(screen.getByText('notes.txt')).toBeInTheDocument()
    })

    // `assets/img` holds thousands of files in an ordinary project. Reading it because it is
    // there, rather than because someone opened it, is the cost this design exists to avoid.
    it('reads a folder only once it is opened', async () => {
      withProject()
      const { listFolder } = install({
        '': [folder('assets')],
        assets: [folder('img', 'assets')],
      })

      render(<Explorer />)
      await screen.findByText('assets')

      expect(listFolder).toHaveBeenCalledTimes(1)
      expect(listFolder).toHaveBeenCalledWith('')
    })

    it('reads it when it is opened, and shows what it holds', async () => {
      withProject()
      install({ '': [folder('assets')], assets: [file('boulder.png', 'assets')] })

      render(<Explorer />)
      await userEvent.click(await screen.findByText('assets'))
      await userEvent.keyboard('{ArrowRight}')

      expect(await screen.findByText('boulder.png')).toBeInTheDocument()
    })

    /**
     * A folder nobody has opened has no children LOADED, which is not the same as having none.
     * Read the first way, it draws no chevron and can never be opened at all.
     */
    it('offers to open a folder it has not read yet', async () => {
      withProject()
      install({ '': [folder('assets')] })

      render(<Explorer />)
      await screen.findByText('assets')

      expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes a folder again, and its contents go with it', async () => {
      withProject()
      install({ '': [folder('assets')], assets: [file('one.png', 'assets')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('assets'))
      await screen.findByText('one.png')
      await userEvent.dblClick(screen.getByText('assets'))

      await waitFor(() => expect(screen.queryByText('one.png')).not.toBeInTheDocument())
    })

    // Every path in the tree named the folder just left: kept a frame longer, its rows are
    // clickable and lead nowhere.
    it('drops the whole tree when another project opens', async () => {
      withProject()
      install({ '': [file('first.txt')] })
      const { rerender } = render(<Explorer />)
      await screen.findByText('first.txt')

      install({ '': [file('second.txt')] })
      useProject.setState({
        project: {
          path: '/projects/other',
          manifest: { version: 1, name: 'other', createdAt: '', updatedAt: '' },
        },
      })
      rerender(<Explorer />)

      expect(await screen.findByText('second.txt')).toBeInTheDocument()
      expect(screen.queryByText('first.txt')).not.toBeInTheDocument()
    })

    // A plain browser has no bridge, and neither does a window before the preload answers.
    it('draws its empty state rather than throwing with nothing to ask', async () => {
      withProject()
      vi.unstubAllGlobals()

      render(<Explorer />)

      expect(await screen.findByText(/n’a pas pu être lu/)).toBeInTheDocument()
    })

    // Often it is the disk event itself that says the folder went. It contributes nothing
    // rather than failing the whole pass.
    it('keeps its footing when a folder will not answer', async () => {
      withProject()
      installFakeBridge({
        project: {
          listFolder: (relative: string) =>
            relative === ''
              ? Promise.resolve([folder('assets'), file('notes.txt')])
              : Promise.reject(new Error('gone')),
        },
      })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('assets'))

      expect(screen.getByText('notes.txt')).toBeInTheDocument()
    })

    it('draws no chevron on a file', async () => {
      withProject()
      install({ '': [file('notes.txt')] })

      render(<Explorer />)
      await screen.findByText('notes.txt')

      expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded')
    })
  })

  /** The reason the panel exists, and the arrival of the tree must not cost it. */
  describe('opening what a row names', () => {
    it('opens a document of the project, tab or no tab', async () => {
      withProject()
      install({ '': [folder('documents')], documents: [file('a3f1.scene', 'documents')] }, [scene])

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('documents'))
      await userEvent.dblClick(await screen.findByText('a3f1.scene'))

      expect(openDocument).toHaveBeenCalledWith(scene)
    })

    // A folder the user owns can hold anything, and the studio has no business refusing a
    // `.pdf` it never claimed to open.
    it('hands a file it cannot open to the system', async () => {
      withProject()
      const { openFile } = install({ '': [file('brief.pdf')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('brief.pdf'))

      expect(openFile).toHaveBeenCalledWith('brief.pdf')
      expect(openDocument).not.toHaveBeenCalled()
    })

    // A `.scene` whose descriptor the project does not list is a file like any other: the
    // studio cannot open what it has no envelope for, and the system might.
    it('does not take a document extension for a document', async () => {
      withProject()
      const { openFile } = install({ '': [file('stray.scene')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('stray.scene'))

      expect(openDocument).not.toHaveBeenCalled()
      expect(openFile).toHaveBeenCalledWith('stray.scene')
    })

    // `README` has no extension at all, and `.gitignore` is all extension. Neither is a
    // document, and reading the dot the wrong way makes one of them look like one.
    it('takes a file with no extension for what it is', async () => {
      withProject()
      const { openFile } = install({ '': [file('README')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('README'))

      expect(openFile).toHaveBeenCalledWith('README')
      expect(openDocument).not.toHaveBeenCalled()
    })

    // The bridge is what listed the folder, so it was there a moment ago — and it is gone when
    // the window is tearing down. A row clicked in that window must not throw into the console.
    it('says nothing when the bridge went away between the listing and the click', async () => {
      withProject()
      install({ '': [file('brief.pdf')] })

      render(<Explorer />)
      await screen.findByText('brief.pdf')
      vi.unstubAllGlobals()

      await expect(userEvent.dblClick(screen.getByText('brief.pdf'))).resolves.toBeUndefined()
    })

    it('opens a folder rather than handing it to the system', async () => {
      withProject()
      const { openFile } = install({ '': [folder('assets')], assets: [file('one.png', 'assets')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('assets'))

      expect(await screen.findByText('one.png')).toBeInTheDocument()
      expect(openFile).not.toHaveBeenCalled()
    })

    it('marks the documents a tab is already showing', async () => {
      withProject()
      useDocuments.setState({ documents: { a3f1: scene } })
      install({ '': [file('a3f1.scene')] }, [scene])

      render(<Explorer />)

      await screen.findByText('a3f1.scene')
      expect(screen.getByText('Ouvert')).toBeInTheDocument()
    })
  })

  /**
   * The tree follows the disk rather than a button. What the main process announces is "something
   * moved", never what: the panel re-reads the folders it has open, which is never wrong about
   * which one to invalidate.
   */
  describe('following the disk', () => {
    it('reads again when the main process says the folder changed', async () => {
      withProject()
      let announce = (): void => undefined
      const listFolder = vi.fn(() => Promise.resolve([file('one.txt')]))
      installFakeBridge({
        project: {
          listFolder,
          onFolderChanged: callback => {
            announce = callback
            return () => undefined
          },
        },
      })

      render(<Explorer />)
      await screen.findByText('one.txt')
      listFolder.mockResolvedValue([file('two.txt')])
      announce()

      expect(await screen.findByText('two.txt')).toBeInTheDocument()
      expect(screen.queryByText('one.txt')).not.toBeInTheDocument()
    })

    // Not a duplicate of the watch: a recursive watch is not offered everywhere, and a project
    // on a network volume can emit nothing at all.
    it('reads again when the window comes back to the front', async () => {
      withProject()
      const { listFolder } = install({ '': [file('one.txt')] })

      render(<Explorer />)
      await screen.findByText('one.txt')
      window.dispatchEvent(new Event('focus'))

      await waitFor(() => expect(listFolder).toHaveBeenCalledTimes(2))
    })
  })
})
