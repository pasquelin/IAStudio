import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { FileOutcome } from '@shared/domain/file-op'
import type { FolderEntry } from '@shared/domain/folder'
import { refreshPalette } from '@/engines/core/palette'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { fakeMenu } from '@/helpers/menu-fixtures'
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

const scene: DocumentDescriptor = {
  id: 'a3f1',
  kind: 'scene',
  title: 'Niveau',
  workspace: '3d',
  fileName: 'a3f1.scene',
}

/** Written as a folder — `FOLDER_KINDS` — which is what the folder reader sees of it. */
const picture: DocumentDescriptor = {
  id: 'a3f1',
  kind: 'image',
  title: 'Planche',
  workspace: 'image',
  fileName: 'a3f1.img',
}

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
/** Reset per case in `beforeEach`, and read by `install` — every case here raises a menu. */
let menu = fakeMenu()

/** An empty batch, which is what a gesture nobody stubbed owes: nothing moved, nothing refused. */
const nothingMoved = (): Promise<FileOutcome> =>
  Promise.resolve({ done: [], refused: [], batch: 'batch-1' })

function install(
  byFolder: Record<string, FolderEntry[]>,
  documents: DocumentDescriptor[] = [],
  catalogued: readonly Asset[] = [],
) {
  const listFolder = vi.fn((relative: string) => Promise.resolve(byFolder[relative] ?? []))
  const openFile = vi.fn(() => Promise.resolve(true))
  const revealFile = vi.fn(() => Promise.resolve())
  const renameFile = vi.fn(nothingMoved)
  const moveFiles = vi.fn(nothingMoved)
  const trashFiles = vi.fn(nothingMoved)
  const duplicateFiles = vi.fn(nothingMoved)
  const pasteFiles = vi.fn(nothingMoved)
  const newFolder = vi.fn(nothingMoved)
  const undoFile = vi.fn(nothingMoved)
  const redoFile = vi.fn(nothingMoved)
  // What renaming an asset goes through: its file moves with its name, so the catalogue's
  // channel carries both — never `project.renameFile`, which refuses everything under `assets/`.
  const update = vi.fn((assetId: string) => {
    const held = catalogued.find(asset => asset.id === assetId)
    return held ? Promise.resolve(held) : Promise.reject(new Error('asset-not-found'))
  })
  installFakeBridge({
    project: {
      listFolder,
      openFile,
      revealFile,
      renameFile,
      moveFiles,
      trashFiles,
      duplicateFiles,
      pasteFiles,
      newFolder,
      undoFile,
      redoFile,
    },
    documents: { list: () => Promise.resolve(documents) },
    menu: menu.bridge,
    assets: {
      search: (query: AssetQuery) =>
        Promise.resolve(catalogued.filter(asset => asset.path === query.path)),
      update,
    },
  })
  return {
    listFolder,
    openFile,
    revealFile,
    renameFile,
    moveFiles,
    trashFiles,
    duplicateFiles,
    pasteFiles,
    newFolder,
    undoFile,
    redoFile,
    update,
  }
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
  useLayouts.setState({ layout: null })
  menu = fakeMenu()
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
     * A folder is read as a list of names, and it used to be measured for a second line that one
     * row in thirty carried — the word « open » under a document the studio has a tab on. `Tree`
     * is handed a NUMBER for its estimate, so every row in the panel stood at the taller gauge:
     * 36px against a control's 28, five or six fewer folders on screen. The word went on
     * 2026-08-14 and the mark it repeated — a dot of accent in the pinned column — stayed.
     */
    it('measures its rows as a control, not as a stack of two lines', async () => {
      withProject()
      install({ '': [file('a3f1.scene')] }, [scene])
      // Declared, so the assertion answers to the STYLESHEET rather than to the fallback the
      // suite would otherwise compare with itself. Compact values, where the overflow bit.
      declareGauge('--sc-control', '24px')
      declareGauge('--sc-row-stacked', '32px')

      render(<Explorer />)
      await screen.findByText('Niveau')

      const row = screen.getByRole('treeitem').closest('li')
      expect(row).toHaveStyle({ height: '24px' })
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
      await userEvent.dblClick(await screen.findByText('Niveau'))

      expect(openDocument).toHaveBeenCalledWith(scene)
    })

    /**
     * An image document IS a directory — `<id>.img/` holding its manifest and its parts — and
     * the folder reader can only see the directory. Taken for an ordinary folder, it folded
     * open on the studio's own files instead of opening, wore a folder glyph where every other
     * document wears its space, and could be renamed while a tab held it.
     */
    it('opens an image document rather than folding it open', async () => {
      withProject()
      install({ '': [folder('a3f1.img')] }, [picture])

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('Planche'))

      expect(openDocument).toHaveBeenCalledWith(picture)
      expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded')
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

    /**
     * The GLYPH in accent ink, and nothing added to the line: the mark has been a word under the
     * name and then a dot before the icon, and both were paid for by every other row — a stacked
     * height throughout for the first, a column and a gutter for the second. Colouring what is
     * already on screen costs the thirty rows that are not open exactly nothing.
     *
     * Read off the class because the glyph is `aria-hidden` and has nothing else to be asked for
     * by: it says « open » to the eye, and what says it to a reader is the tab itself.
     *
     * Two files in one folder rather than two cases, because « and them alone » is the whole of
     * what a mark is for: a mark on every row says nothing.
     */
    it('marks the documents a tab is showing, and them alone', async () => {
      withProject()
      useDocuments.setState({ documents: { a3f1: scene } })
      install({ '': [file('a3f1.scene'), file('other.scene')] }, [scene])

      render(<Explorer />)
      await screen.findByText('Niveau')

      const marked = (name: string): Element | null | undefined =>
        screen.getByText(name).closest('[role="treeitem"]')?.querySelector('.text-accent-ink')

      // `Niveau` is the document's name; `other.scene` is a file no descriptor came back for,
      // so it keeps the name the folder gives it.
      expect(marked('Niveau')).toBeInTheDocument()
      expect(marked('other.scene')).not.toBeInTheDocument()
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
    const { moveFiles } = install({ '': [folder('notes'), file('brief.pdf')] })

    render(<Explorer />)
    await drag('brief.pdf', 'notes')

    expect(moveFiles).toHaveBeenCalledWith(['brief.pdf'], 'notes')
  })

  it('moves it by its whole path, not by the name the row shows', async () => {
    withProject()
    const { moveFiles } = install({
      '': [folder('notes'), folder('refs')],
      notes: [file('brief.pdf', 'notes')],
    })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{ArrowRight}')
    await drag('brief.pdf', 'refs')

    expect(moveFiles).toHaveBeenCalledWith(['notes/brief.pdf'], 'refs')
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
    const { moveFiles } = install({ '': [folder('assets'), file('brief.pdf')] })

    render(<Explorer />)
    await drag('brief.pdf', 'assets')

    expect(moveFiles).not.toHaveBeenCalled()
  })

  // A file is not a place. Dropping onto one used to be worth an outline it could not honour.
  it('drops nothing onto a file', async () => {
    withProject()
    const { moveFiles } = install({ '': [file('brief.pdf'), file('notes.txt')] })

    render(<Explorer />)
    await drag('brief.pdf', 'notes.txt')

    expect(moveFiles).not.toHaveBeenCalled()
  })

  it('drops nothing onto a folder inside the one being dragged', async () => {
    withProject()
    const { moveFiles } = install({
      '': [folder('notes')],
      notes: [folder('drafts', 'notes')],
    })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{ArrowRight}')
    await drag('notes', 'drafts')

    expect(moveFiles).not.toHaveBeenCalled()
  })
})

/**
 * Picking more than one row, and doing something to all of them.
 *
 * The panel used to drop the `mode` the tree resolved — `onSelect={setSelectedIds}` — so every
 * ⌘-click REPLACED the selection instead of adding to it, in a panel whose whole point is to
 * move several files at once.
 */
describe('picking several rows of the explorer', () => {
  const rowFor = async (name: string): Promise<HTMLElement> => {
    const label = await screen.findByText(name)
    const row = label.closest('[role="treeitem"]')
    if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`)
    return row
  }

  const picked = (): string[] =>
    screen
      .getAllByRole('treeitem')
      .filter(row => row.getAttribute('aria-selected') === 'true')
      .map(row => row.textContent ?? '')

  /**
   * One session for the whole gesture, in every case here: the direct API opens a new one per
   * call, and the held modifier is released before the click that is supposed to read it.
   */
  it('adds to what is already picked on a command-click', async () => {
    withProject()
    install({ '': [file('a.png'), file('b.png'), file('c.png')] })
    const user = userEvent.setup()

    render(<Explorer />)
    await user.click(await screen.findByText('a.png'))
    await user.keyboard('{Meta>}')
    await user.click(await screen.findByText('c.png'))
    await user.keyboard('{/Meta}')

    expect(picked()).toEqual(['a.png', 'c.png'])
  })

  it('takes the whole range on a shift-click', async () => {
    withProject()
    install({ '': [file('a.png'), file('b.png'), file('c.png')] })
    const user = userEvent.setup()

    render(<Explorer />)
    await user.click(await screen.findByText('a.png'))
    await user.keyboard('{Shift>}')
    await user.click(await screen.findByText('c.png'))
    await user.keyboard('{/Shift}')

    expect(picked()).toEqual(['a.png', 'b.png', 'c.png'])
  })

  // The batch is settled when the drag STARTS and read on every hover: the platform answers
  // nothing about a payload until the drop, so a target could not otherwise know what is coming.
  it('carries the whole selection when one of its rows is dragged', async () => {
    withProject()
    const { moveFiles } = install({ '': [folder('notes'), file('a.png'), file('b.png')] })
    const user = userEvent.setup()

    render(<Explorer />)
    await user.click(await screen.findByText('a.png'))
    await user.keyboard('{Meta>}')
    await user.click(await screen.findByText('b.png'))
    await user.keyboard('{/Meta}')

    const data = dragTransfer()
    fireEvent.dragStart(await rowFor('a.png'), { dataTransfer: data })
    fireEvent.drop(await rowFor('notes'), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['a.png', 'b.png'], 'notes')
  })

  // What every file browser does, and what keeps a slip of the hand from moving thirty files.
  it('drags a row outside the selection alone, leaving the selection whole', async () => {
    withProject()
    const { moveFiles } = install({ '': [folder('notes'), file('a.png'), file('b.png')] })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('a.png'))

    const data = dragTransfer()
    fireEvent.dragStart(await rowFor('b.png'), { dataTransfer: data })
    fireEvent.drop(await rowFor('notes'), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['b.png'], 'notes')
  })

  /**
   * How a file comes back OUT of a folder: no row stands for the project folder, so the blank
   * below the tree is what names it.
   */
  it('sends a file to the project folder when it is dropped on the blank below the rows', async () => {
    withProject()
    const { moveFiles } = install({
      '': [folder('notes')],
      notes: [file('a.png', 'notes')],
    })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{ArrowRight}')

    const data = dragTransfer()
    fireEvent.dragStart(await rowFor('a.png'), { dataTransfer: data })
    const blank = screen.getByRole('tree').parentElement
    fireEvent.drop(blank!, { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['notes/a.png'], '')
  })
})

/**
 * The eight commands, which act on the SELECTION rather than on a row — the whole point of the
 * scope. Heard only while the focus is inside the panel: a ⌘Z in the canvas must not reach the
 * disk, and `commandFor` filters by scope for exactly that.
 */
describe('the explorer commands', () => {
  it('holds a cut selection back until a folder is named to paste it into', async () => {
    withProject()
    const { pasteFiles, moveFiles } = install({ '': [folder('notes'), file('a.png')] })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('a.png'))
    await userEvent.keyboard('{Meta>}x{/Meta}')

    // Nothing has moved yet, and nothing will until the paste says where.
    expect(moveFiles).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{Meta>}v{/Meta}')

    expect(pasteFiles).toHaveBeenCalledWith(['a.png'], 'notes', true)
  })

  // A copy stays on the clipboard, so pasting into three folders in a row is three copies rather
  // than one and two silences.
  it('pastes a copy into the folder on screen, and keeps it for the next one', async () => {
    withProject()
    const { pasteFiles } = install({ '': [folder('notes'), folder('refs'), file('a.png')] })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('a.png'))
    await userEvent.keyboard('{Meta>}c{/Meta}')
    await userEvent.click(await screen.findByText('notes'))
    await userEvent.keyboard('{Meta>}v{/Meta}')
    await userEvent.click(await screen.findByText('refs'))
    await userEvent.keyboard('{Meta>}v{/Meta}')

    expect(pasteFiles).toHaveBeenNthCalledWith(1, ['a.png'], 'notes', false)
    expect(pasteFiles).toHaveBeenNthCalledWith(2, ['a.png'], 'refs', false)
  })

  it('duplicates and trashes the whole selection at once', async () => {
    withProject()
    const { duplicateFiles, trashFiles } = install({ '': [file('a.png'), file('b.png')] })
    const user = userEvent.setup()

    render(<Explorer />)
    await user.click(await screen.findByText('a.png'))
    await user.keyboard('{Meta>}')
    await user.click(await screen.findByText('b.png'))
    await user.keyboard('{/Meta}')

    await user.keyboard('{Meta>}d{/Meta}')
    expect(duplicateFiles).toHaveBeenCalledWith(['a.png', 'b.png'])

    await user.keyboard('{Meta>}{Backspace}{/Meta}')
    expect(trashFiles).toHaveBeenCalledWith(['a.png', 'b.png'])
  })

  // The folder on screen is the picked row when it is one, and the project folder when nothing
  // is picked — which is what makes ⇧⌘N work before anything has been clicked.
  it('makes a folder inside the picked one, and at the root when nothing is picked', async () => {
    withProject()
    const { newFolder } = install({ '': [folder('notes')] })

    render(<Explorer />)
    await screen.findByText('notes')
    // Focused without being clicked, which is the state the first case is about: the panel arms
    // its scope on the focus, and nothing is picked yet. Inside `act`, or the effect that
    // subscribes to the keyboard has not run by the time the key below is pressed.
    await act(async () => screen.getAllByRole('treeitem')[0]?.focus())
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', metaKey: true, shiftKey: true })

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('', 'dossier'))

    await userEvent.click(await screen.findByText('notes'))
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', metaKey: true, shiftKey: true })

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('notes', 'dossier'))
  })

  // Heard by the panel and nowhere else: the stack lives in the main process, and the scope is
  // what keeps a ⌘Z aimed at a canvas from reaching the disk.
  it('asks the main process to take the last batch back', async () => {
    withProject()
    const { undoFile } = install({ '': [file('a.png')] })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('a.png'))
    await userEvent.keyboard('{Meta>}z{/Meta}')

    expect(undoFile).toHaveBeenCalled()
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
    menu.picks('Afficher dans le dossier')

    render(<Explorer />)
    await open('brief.pdf')

    await waitFor(() => expect(revealFile).toHaveBeenCalledWith('brief.pdf'))
  })

  it('moves a file to the trash rather than deleting it', async () => {
    withProject()
    const { trashFiles } = install({ '': [file('brief.pdf')] })
    menu.picks('Mettre à la corbeille')

    render(<Explorer />)
    await open('brief.pdf')

    await waitFor(() => expect(trashFiles).toHaveBeenCalledWith(['brief.pdf']))
  })

  /**
   * The catalogue stores every asset by a path under `assets/`, so moving one orphans rows
   * nobody can find again. Greyed rather than dropped: a menu that changes length is a menu one
   * cannot learn.
   */
  it('refuses to move the studio own folders, and says so before the click', async () => {
    withProject()
    install({ '': [folder('assets')] })

    render(<Explorer />)
    await open('assets')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(false))
    expect(menu.offers('Mettre à la corbeille')).toBe(false)
    expect(menu.offers('Afficher dans le dossier')).toBe(true)
  })

  /**
   * The one gesture the old identity forbade: a document's file name WAS its id, so renaming an
   * open one orphaned its tab and the next save wrote the old name back beside the new file. The
   * id lives in the envelope now and stays put, so a tab can hold a document being renamed.
   */
  it('renames a document a tab is holding', async () => {
    withProject()
    useDocuments.setState({ documents: { a3f1: scene } })
    install({ '': [file('a3f1.scene')] }, [scene])

    render(<Explorer />)
    await open('Niveau')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(true))
  })

  it('renames a document through its own channel, never as a plain file', async () => {
    withProject()
    const { renameFile } = install({ '': [file('a3f1.scene')] }, [scene])
    const rename = vi.fn(() => Promise.resolve({ ...scene, title: 'Décor' }))
    installFakeBridge({
      project: { listFolder: () => Promise.resolve([file('a3f1.scene')]) },
      documents: { list: () => Promise.resolve([scene]), rename },
      menu: menu.bridge,
    })
    menu.picks('Renommer')

    render(<Explorer />)
    await open('Niveau')
    const field = await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Décor{Enter}')

    expect(rename).toHaveBeenCalledWith('a3f1', 'scene', 'Décor')
    expect(renameFile).not.toHaveBeenCalled()
  })

  /**
   * The complaint this answers, and the whole of the change behind it: the explorer showed
   * `asset_40f76c36-8ad4-….png` where the shelf showed « je veux un model avec son skeleton »,
   * and « Renommer » was greyed out on both. One name now stands for the row and its file, so
   * the gesture exists — through the catalogue's channel, never as a plain file, which the main
   * process refuses under `assets/`.
   */
  it('renames an asset through the catalogue, never as a plain file', async () => {
    withProject()
    const boulder: Asset = {
      id: 'asset_1',
      name: 'Boulder',
      type: 'image',
      location: 'local',
      path: 'assets/Boulder.png',
      tags: [],
      createdAt: '2026-08-16T10:00:00.000Z',
    }
    const { renameFile, update } = install(
      { '': [folder('assets')], assets: [file('Boulder.png', 'assets')] },
      [],
      [boulder],
    )
    menu.picks('Renommer')

    render(<Explorer />)
    await userEvent.dblClick(await screen.findByText('assets'))
    await open('Boulder.png')
    const field = await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Ruelle bleue.png{Enter}')

    // The stem, without the extension the panel draws: the suffix follows the bytes, and a name
    // carrying one would grow a second on the next rename — `Ruelle.png.png`.
    await waitFor(() => expect(update).toHaveBeenCalledWith('asset_1', { name: 'Ruelle bleue' }))
    expect(renameFile).not.toHaveBeenCalled()
  })

  /** Greyed for years, on a refusal that was about the channel rather than about the gesture. */
  it('offers the gesture on a file the catalogue holds', async () => {
    withProject()
    install(
      { '': [folder('assets')], assets: [file('Boulder.png', 'assets')] },
      [],
      [
        {
          id: 'asset_1',
          name: 'Boulder',
          type: 'image',
          location: 'local',
          path: 'assets/Boulder.png',
          tags: [],
          createdAt: '2026-08-16T10:00:00.000Z',
        },
      ],
    )

    render(<Explorer />)
    await userEvent.dblClick(await screen.findByText('assets'))
    await open('Boulder.png')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(true))
  })

  /**
   * A picture the user dropped into `assets/` themselves is no row of ours: `renameFile` refuses
   * everything under there, and no other channel claims it. Offering the gesture opened a field
   * that closed on a failure only the journal mentioned — worse than the grey it replaced, which
   * is why the catalogue is asked BEFORE the menu is drawn.
   */
  it('greys it out for a file under assets the catalogue never heard of', async () => {
    withProject()
    install({ '': [folder('assets')], assets: [file('dropped.png', 'assets')] })

    render(<Explorer />)
    await userEvent.dblClick(await screen.findByText('assets'))
    await open('dropped.png')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(false))
    // Not a refusal of the row itself: showing it in the folder is what still works.
    expect(menu.offers('Afficher dans le dossier')).toBe(true)
  })

  it('renames where the name is read', async () => {
    withProject()
    const { renameFile } = install({ '': [file('brief.pdf')] })
    menu.picks('Renommer')

    render(<Explorer />)
    await open('brief.pdf')
    const field = await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.clear(field)
    await userEvent.type(field, 'note.pdf{Enter}')

    expect(renameFile).toHaveBeenCalledWith('brief.pdf', 'note.pdf')
  })

  // The disk is what says the name changed, and the watch is what reads it again. Asking for a
  // rename that is not one would be a write for nothing.
  it('asks for nothing when the name was left as it was', async () => {
    withProject()
    const { renameFile } = install({ '': [file('brief.pdf')] })
    menu.picks('Renommer')

    render(<Explorer />)
    await open('brief.pdf')
    await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.keyboard('{Escape}')

    expect(renameFile).not.toHaveBeenCalled()
  })

  /**
   * Selecting a word in the field is a double-click, and the row underneath read it as "open
   * me": the document opened mid-rename, which greyed "Rename" out — the gesture cancelled
   * itself, and it looked like the field had simply refused to work.
   */
  it('leaves the row alone while its name is being typed in', async () => {
    withProject()
    install({ '': [file('a3f1.scene')] }, [scene])
    menu.picks('Renommer')

    render(<Explorer />)
    await open('Niveau')
    const field = await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.dblClick(field)

    expect(openDocument).not.toHaveBeenCalled()
  })
})
