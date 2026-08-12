import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { FolderEntry } from '@shared/domain/folder'
import { refreshPalette } from '@/engines/core/palette'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Explorer } from './Explorer'

const openDocument = vi.fn()
vi.mock('@/app/dockview-api', () => ({
  openDocument: (...args: unknown[]) => openDocument(...args),
}))

const openAsset = vi.hoisted(() => vi.fn<(asset: Asset) => Promise<void>>(() => Promise.resolve()))
vi.mock('@/helpers/open-asset', () => ({ openAsset }))

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

/**
 * What the main process answers per folder, so a test says what the disk holds and no more.
 *
 * `catalogued` is what the folder cannot say: whether a file it shows is an asset. Empty by
 * default, which is a folder of files the studio has never heard of.
 */
function install(
  byFolder: Record<string, FolderEntry[]>,
  documents: DocumentDescriptor[] = [],
  catalogued: readonly Asset[] = [],
) {
  const listFolder = vi.fn((relative: string) => Promise.resolve(byFolder[relative] ?? []))
  const openFile = vi.fn(() => Promise.resolve(true))
  const revealFile = vi.fn(() => Promise.resolve())
  const renameFile = vi.fn(() => Promise.resolve(true))
  const moveFile = vi.fn(() => Promise.resolve(true))
  const trashFile = vi.fn(() => Promise.resolve(true))
  installFakeBridge({
    project: { listFolder, openFile, revealFile, renameFile, moveFile, trashFile },
    documents: { list: () => Promise.resolve(documents) },
    assets: {
      search: (query: AssetQuery) =>
        Promise.resolve(catalogued.filter(asset => asset.path === query.path)),
    },
  })
  return { listFolder, openFile, revealFile, renameFile, moveFile, trashFile }
}

/** A gauge the stylesheet would apply, which jsdom does not. Dropped after every case. */
function declareGauge(gauge: string, value: string): void {
  document.documentElement.style.setProperty(gauge, value)
  // The token cache is module-level and shared: without this the next read answers the last case.
  refreshPalette()
}

beforeEach(() => {
  document.documentElement.style.removeProperty('--sc-control')
  document.documentElement.style.removeProperty('--sc-row-stacked')
  refreshPalette()
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  // `known` settled: the panel says nothing at all until the main process has answered, and
  // every case below is about what it says once it has.
  useProject.setState({ project: null, known: true })
  useLayouts.setState({ layouts: {} })
  installFakeBridge({})
})

describe('the project explorer', () => {
  it('says so when no project is open, rather than listing nothing', () => {
    render(<Explorer />)
    expect(screen.getByText(/Aucun projet ouvert/)).toBeInTheDocument()
  })

  /**
   * The studio reopens the last project on launch, and `project` is `null` until it says so.
   * Read as an answer, that `null` offered to create a project to someone who already had one
   * — for as long as the reopening took, on every start.
   */
  it('offers nothing before the main process has said whether there is one', () => {
    useProject.setState({ project: null, known: false })

    render(<Explorer />)

    expect(screen.queryByText(/Aucun projet ouvert/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Créer un projet' })).toBeNull()
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

    /**
     * A row of this tree stacks a name over a second line for a document that is open, and two
     * steps of `leading-tight` text are 27.5px — they fill a 28px control row edge to edge and
     * overflow a compact one. The tree reserved a control's height for every row, so the name
     * and the « open » line spilled over the row below and the tint that marks the row stopped
     * where the text did not.
     */
    it('reserves the height a stacked row needs, not a control’s', async () => {
      withProject()
      install({ '': [file('a3f1.scene')] }, [scene])
      // Declared, so the assertion answers to the STYLESHEET rather than to the fallback the
      // suite would otherwise compare with itself. Compact values, where the overflow bit.
      declareGauge('--sc-control', '24px')
      declareGauge('--sc-row-stacked', '32px')

      render(<Explorer />)
      await screen.findByText('a3f1.scene')

      const row = screen.getByRole('treeitem').closest('li')
      expect(row).toHaveStyle({ height: '32px' })
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

    /**
     * The complaint this answers: double-clicking a generated picture launched a picture viewer.
     * The folder shows `asset_2604….png`, the shelf shows « Gemini 3.1 », and only the catalogue
     * knows they are the same thing — so the extension alone cannot decide.
     */
    it('opens an asset in its own editor rather than in another application', async () => {
      withProject()
      const { openFile } = install(
        { '': [folder('assets')], assets: [file('boulder.png', 'assets')] },
        [],
        [
          {
            id: 'asset_1',
            name: 'Gemini 3.1',
            type: 'image',
            location: 'local',
            path: 'assets/boulder.png',
            tags: [],
            createdAt: '2026-08-12T10:00:00.000Z',
          },
        ],
      )

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('assets'))
      await userEvent.dblClick(await screen.findByText('boulder.png'))

      await waitFor(() => expect(openAsset).toHaveBeenCalledTimes(1))
      expect(vi.mocked(openAsset).mock.calls[0]?.[0]).toMatchObject({ id: 'asset_1' })
      expect(openFile).not.toHaveBeenCalled()
    })

    // A file under a project folder the catalogue has never recorded — dropped in by hand — is
    // not an asset, and the system is still where it goes.
    it('still hands a file the catalogue does not know to the system', async () => {
      withProject()
      const { openFile } = install({
        '': [folder('assets')],
        assets: [file('stray.png', 'assets')],
      })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('assets'))
      await userEvent.dblClick(await screen.findByText('stray.png'))

      await waitFor(() => expect(openFile).toHaveBeenCalledWith('assets/stray.png'))
      expect(openAsset).not.toHaveBeenCalled()
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

/**
 * Dragging moves; the menu's "Rename" stays in the folder the file already sits in. The
 * refusals are read from `shared/`, so what the panel greys out is what the main process would
 * refuse — and a drag names both sides, which is the half the menu never had to answer for.
 */
describe('dragging a row of the explorer', () => {
  const rowFor = async (name: string): Promise<HTMLElement> => {
    const label = await screen.findByText(name)
    const row = label.closest('[role="treeitem"]')
    if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`)
    return row
  }

  const drag = async (from: string, onto: string): Promise<void> => {
    const data = dragTransfer()
    fireEvent.dragStart(await rowFor(from), { dataTransfer: data })
    fireEvent.drop(await rowFor(onto), { dataTransfer: data })
  }

  it('moves the dragged file into the folder it was dropped on', async () => {
    withProject()
    const { moveFile } = install({ '': [folder('notes'), file('brief.pdf')] })

    render(<Explorer />)
    await drag('brief.pdf', 'notes')

    expect(moveFile).toHaveBeenCalledWith('brief.pdf', 'notes')
  })

  it('moves it by its whole path, not by the name the row shows', async () => {
    withProject()
    const { moveFile } = install({
      '': [folder('notes'), folder('refs')],
      notes: [file('brief.pdf', 'notes')],
    })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{ArrowRight}')
    await drag('brief.pdf', 'refs')

    expect(moveFile).toHaveBeenCalledWith('notes/brief.pdf', 'refs')
  })

  // The catalogue stores every asset by a path under `assets/`, and the studio's own folders
  // refuse on both sides of the gesture — as what moves, and as what receives.
  it('will not pick up a studio folder', async () => {
    withProject()
    install({ '': [folder('assets'), folder('notes')] })

    render(<Explorer />)

    expect(await rowFor('assets')).not.toHaveAttribute('draggable', 'true')
    expect(await rowFor('notes')).toHaveAttribute('draggable', 'true')
  })

  it('drops nothing into a studio folder', async () => {
    withProject()
    const { moveFile } = install({ '': [folder('assets'), file('brief.pdf')] })

    render(<Explorer />)
    await drag('brief.pdf', 'assets')

    expect(moveFile).not.toHaveBeenCalled()
  })

  // A file is not a place. Dropping onto one used to be worth an outline it could not honour.
  it('drops nothing onto a file', async () => {
    withProject()
    const { moveFile } = install({ '': [file('brief.pdf'), file('notes.txt')] })

    render(<Explorer />)
    await drag('brief.pdf', 'notes.txt')

    expect(moveFile).not.toHaveBeenCalled()
  })

  it('drops nothing onto a folder inside the one being dragged', async () => {
    withProject()
    const { moveFile } = install({
      '': [folder('notes')],
      notes: [folder('drafts', 'notes')],
    })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{ArrowRight}')
    await drag('notes', 'drafts')

    expect(moveFile).not.toHaveBeenCalled()
  })
})

/**
 * Three rows, and two of them refuse in cases the panel can name. Nothing is deleted: the file
 * goes to the system's trash, where its owner can get it back.
 */
describe('the explorer menu', () => {
  const open = async (name: string): Promise<void> => {
    await userEvent.pointer({ keys: '[MouseRight]', target: await screen.findByText(name) })
  }

  it('shows a file in the system file manager', async () => {
    withProject()
    const { revealFile } = install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    await open('brief.pdf')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' }))

    expect(revealFile).toHaveBeenCalledWith('brief.pdf')
  })

  it('moves a file to the trash rather than deleting it', async () => {
    withProject()
    const { trashFile } = install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    await open('brief.pdf')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mettre à la corbeille' }))

    expect(trashFile).toHaveBeenCalledWith('brief.pdf')
  })

  /**
   * The catalogue stores every asset by a path under `assets/`, so moving one orphans rows
   * nobody can find again. Shown disabled rather than hidden: a menu that changes length is a
   * menu one cannot learn.
   */
  it('refuses to move the studio own folders, and says so before the click', async () => {
    withProject()
    install({ '': [folder('assets')] })

    render(<Explorer />)
    await open('assets')

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Mettre à la corbeille' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Révéler dans le dossier' })).toBeEnabled()
  })

  // A document's file name IS its identifier: renaming one a tab is holding orphans that tab,
  // and the next save writes the old name back beside the new file.
  it('refuses to rename a document a tab is holding', async () => {
    withProject()
    useDocuments.setState({ documents: { a3f1: scene } })
    install({ '': [file('a3f1.scene')] }, [scene])

    render(<Explorer />)
    await open('a3f1.scene')

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeDisabled()
  })

  it('renames a document no tab is holding', async () => {
    withProject()
    install({ '': [file('a3f1.scene')] }, [scene])

    render(<Explorer />)
    await open('a3f1.scene')

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeEnabled()
  })

  it('renames where the name is read', async () => {
    withProject()
    const { renameFile } = install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    await open('brief.pdf')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'note.pdf{Enter}')

    expect(renameFile).toHaveBeenCalledWith('brief.pdf', 'note.pdf')
  })

  // The disk is what says the name changed, and the watch is what reads it again. Asking for a
  // rename that is not one would be a write for nothing.
  it('asks for nothing when the name was left as it was', async () => {
    withProject()
    const { renameFile } = install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    await open('brief.pdf')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    await userEvent.keyboard('{Escape}')

    expect(renameFile).not.toHaveBeenCalled()
  })
})
