import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { stemOf } from '@shared/domain/fileName'
import type { FileOutcome } from '@shared/domain/fileOp'
import { natureOf, opensInStudio } from '@shared/domain/fileRole'
import type { FolderEntry } from '@shared/domain/folder'
import { refreshPalette } from '@/engines/core/palette'
import { startAssetDrag } from '@/helpers/assetDrag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { LIST_ONLY } from '@/helpers/collectionState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useExplorerView } from '@/stores/explorerView'
import { useSelection } from '@/stores/selection'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Explorer } from './Explorer'

const openDocument = vi.fn()
vi.mock('@/app/dockviewApi', () => ({
  openDocument: (...args: unknown[]) => openDocument(...args),
}))

const openAsset = vi.hoisted(() => vi.fn<(asset: Asset) => Promise<void>>(() => Promise.resolve()))
vi.mock('@/helpers/openAsset', () => ({ openAsset }))

const scene: DocumentDescriptor = {
  id: 'a3f1',
  kind: 'scene',
  title: 'Niveau',
  workspace: '3d',
  path: 'a3f1.gltf',
}

/** Written in the open format, and a document all the same — whoever wrote the file. */
const montage: DocumentDescriptor = {
  id: 'cut',
  kind: 'sequence',
  title: 'Bande',
  workspace: 'video',
  path: 'Bande.otio',
}

/** A container, so one FILE — which is what the folder reader sees of it. */
const picture: DocumentDescriptor = {
  id: 'a3f1',
  kind: 'image',
  title: 'Planche',
  workspace: 'image',
  path: 'a3f1.ora',
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

/** Reset per case in `beforeEach`, and read by `install` — every case here raises a menu. */
let menu = fakeMenu()

/** An empty batch, which is what a gesture nobody stubbed owes: nothing moved, nothing refused. */
const nothingMoved = (): Promise<FileOutcome> =>
  Promise.resolve({ done: [], refused: [], batch: 'batch-1' })

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
  /** What the whole folder answers per term — the panel's other source of nodes. */
  found: Record<string, FolderEntry[]> = {},
  /** Every file of the project, which is what the domain view reads. */
  walked: FolderEntry[] = [],
) {
  // The second argument is what the reader asked to SEE — the filtering is the main process's,
  // and is held there (`folder.test.ts`). What a case reads here is that the panel asked.
  const listFolder = vi.fn((relative: string, _hidden?: boolean) =>
    Promise.resolve(byFolder[relative] ?? []),
  )
  const searchFolder = vi.fn((term: string, _hidden?: boolean) =>
    Promise.resolve(found[term] ?? []),
  )
  const walkFolder = vi.fn((_hidden?: boolean) => Promise.resolve(walked))
  const openFile = vi.fn(() => Promise.resolve(true))
  /**
   * What the main process answers, minus the disk: the row it already holds, else one minted for
   * a file the studio can show, else nothing at all. `opensInStudio` is the very table the main
   * reads, so a case here cannot describe an opening the studio would refuse.
   */
  const adopt = vi.fn((relative: string): Promise<Asset | null> => {
    const known = catalogued.find(asset => asset.path === relative)
    if (known) return Promise.resolve(known)

    // A document is never adopted — it is opened, or it is nothing: a `.gltf` the project has
    // no envelope for is a file like any other. `adoptFile` refuses it for the same reason.
    const { domain, role } = natureOf(relative)
    if (role === 'edit' || domain === 'other' || !opensInStudio(relative)) {
      return Promise.resolve(null)
    }

    return Promise.resolve({
      id: `asset_${relative}`,
      name: stemOf(relative),
      type: domain,
      location: 'local',
      path: relative,
      tags: [],
      createdAt: '2026-08-17T10:00:00.000Z',
    })
  })
  const revealFile = vi.fn(() => Promise.resolve())
  const openFileInfo = vi.fn(() => Promise.resolve())
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
      searchFolder,
      walkFolder,
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
    fileInfo: { open: openFileInfo },
    media: { adopt },
    menu: menu.bridge,
    assets: {
      // Both shapes of the same question: one path, or the whole listing at once.
      search: (query: AssetQuery) =>
        Promise.resolve(
          catalogued.filter(asset =>
            query.paths ? query.paths.includes(asset.path ?? '') : asset.path === query.path,
          ),
        ),
      update,
    },
  })
  return {
    listFolder,
    searchFolder,
    walkFolder,
    openFile,
    adopt,
    revealFile,
    openFileInfo,
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
  // Persisted, so a term one case typed would narrow the tree of the next one.
  useExplorerView.setState({ collection: LIST_ONLY, hidden: false, mode: 'folder' })
  menu = fakeMenu()
  installFakeBridge({})
})

/**
 * The listing itself — the tree, or the grid when the panel is showing one.
 *
 * Scoped rather than read off `screen`: the panel reads the file it has picked out UNDER the
 * listing (`FileDetails`), so the name of a picked row is on screen twice and a plain
 * `getByText` on it finds both.
 */
async function listing(): Promise<HTMLElement> {
  return waitFor(() => {
    const shown = screen.queryByRole('tree') ?? screen.queryByRole('listbox')
    if (!shown) throw new Error('the panel is drawing neither a tree nor a grid')
    return shown
  })
}

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

      expect(await within(await listing()).findByText('assets')).toBeInTheDocument()
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
      await within(await listing()).findByText('assets')

      expect(listFolder).toHaveBeenCalledTimes(1)
      expect(listFolder).toHaveBeenCalledWith('', false)
    })

    it('reads it when it is opened, and shows what it holds', async () => {
      withProject()
      install({ '': [folder('assets')], assets: [file('boulder.png', 'assets')] })

      render(<Explorer />)
      await userEvent.click(await within(await listing()).findByText('assets'))
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
      await within(await listing()).findByText('assets')

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
      install({ '': [file('a3f1.gltf')] }, [scene])
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
      await userEvent.dblClick(await within(await listing()).findByText('assets'))
      await within(await listing()).findByText('one.png')
      await userEvent.dblClick(within(await listing()).getByText('assets'))

      await waitFor(async () =>
        expect(within(await listing()).queryByText('one.png')).not.toBeInTheDocument(),
      )
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
      await userEvent.dblClick(await within(await listing()).findByText('assets'))

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
      const filed = { ...scene, path: 'documents/a3f1.gltf' }
      install({ '': [folder('documents')], documents: [file('a3f1.gltf', 'documents')] }, [filed])

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('documents'))
      await userEvent.dblClick(await screen.findByText('Niveau'))

      expect(openDocument).toHaveBeenCalledWith(filed)
    })

    /**
     * Rows are joined to descriptors by PATH, not by name. Two folders may each hold a
     * `Niveau.gltf`, and joined on the name one document's descriptor was handed to the other
     * one's row — the wrong title on screen, and a double-click opening the wrong document.
     */
    it('tells two documents of the same name in two folders apart', async () => {
      withProject()
      const here = { ...scene, id: 'here', title: 'Ici', path: 'Acte 1/a3f1.gltf' }
      const there = { ...scene, id: 'there', title: 'Là', path: 'Acte 2/a3f1.gltf' }
      install(
        {
          '': [folder('Acte 1'), folder('Acte 2')],
          'Acte 1': [file('a3f1.gltf', 'Acte 1')],
          'Acte 2': [file('a3f1.gltf', 'Acte 2')],
        },
        [here, there],
      )

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('Acte 2'))
      await userEvent.dblClick(await screen.findByText('Là'))

      expect(openDocument).toHaveBeenCalledWith(there)
    })

    /**
     * An image document IS a directory — `<id>.ora/` holding its manifest and its parts — and
     * the folder reader can only see the directory. Taken for an ordinary folder, it folded
     * open on the studio's own files instead of opening, wore a folder glyph where every other
     * document wears its space, and could be renamed while a tab held it.
     */
    it('opens an image document rather than folding it open', async () => {
      withProject()
      install({ '': [file('a3f1.ora')] }, [picture])

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('Planche'))

      expect(openDocument).toHaveBeenCalledWith(picture)
      expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded')
    })

    /**
     * A montage in the open format is a DOCUMENT, whichever application wrote it — the studio
     * writes OpenTimelineIO and reads it back, so a `.otio` opens in the video space rather than
     * being adopted as a media or handed to whatever the system opens `.otio` with.
     */
    it('opens a montage held in the open format', async () => {
      withProject()
      const { openFile } = install({ '': [file('Bande.otio')] }, [montage])

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('Bande'))

      expect(openDocument).toHaveBeenCalledWith(montage)
      expect(openFile).not.toHaveBeenCalled()
    })

    // A folder the user owns can hold anything, and the studio has no business refusing a
    // `.pdf` it never claimed to open.
    it('hands a file it cannot open to the system', async () => {
      withProject()
      const { openFile } = install({ '': [file('brief.pdf')] })

      render(<Explorer />)
      await userEvent.dblClick(await within(await listing()).findByText('brief.pdf'))

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
      await userEvent.dblClick(await within(await listing()).findByText('assets'))
      await userEvent.dblClick(await screen.findByText('boulder.png'))

      await waitFor(() => expect(openAsset).toHaveBeenCalledTimes(1))
      expect(vi.mocked(openAsset).mock.calls[0]?.[0]).toMatchObject({ id: 'asset_1' })
      expect(openFile).not.toHaveBeenCalled()
    })

    /**
     * The complaint, in one case: a picture copied into the project by hand launched macOS
     * Preview. The catalogue has never heard of it — and the catalogue is not what decides. The
     * studio adopts the file where it lies, then opens it in its own space.
     */
    it('adopts a picture the catalogue has never heard of, and opens it here', async () => {
      withProject()
      const { openFile, adopt } = install({
        '': [folder('Images')],
        Images: [file('facade.jpg', 'Images')],
      })

      render(<Explorer />)
      await userEvent.dblClick(await within(await listing()).findByText('Images'))
      await userEvent.dblClick(await within(await listing()).findByText('facade.jpg'))

      await waitFor(() => expect(openAsset).toHaveBeenCalledTimes(1))
      expect(adopt).toHaveBeenCalledWith('Images/facade.jpg')
      expect(vi.mocked(openAsset).mock.calls[0]?.[0]).toMatchObject({ path: 'Images/facade.jpg' })
      expect(openFile).not.toHaveBeenCalled()
    })

    /**
     * At icon size, in the tree as in the grid — what every file browser does. A tree that shows
     * a sheet of paper where the grid beside it shows the picture is two answers to one question.
     */
    it('draws a preview in the tree too, and leaves a folder its glyph', async () => {
      withProject()
      install({ '': [folder('Images'), file('facade.jpg')] })

      render(<Explorer />)
      const rowFor = async (name: string): Promise<HTMLElement> => {
        const row = (await within(await listing()).findByText(name)).closest('[role="treeitem"]')
        if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`)
        return row
      }

      expect((await rowFor('facade.jpg')).querySelector('img')).toHaveAttribute(
        'src',
        'ia-studio://thumb/facade.jpg',
      )
      expect((await rowFor('Images')).querySelector('img')).toBeNull()
    })

    // The other half of the same rule, and it is deliberate: the studio has no editor for prose,
    // and pretending otherwise would be worse than opening it outside.
    it('still hands a file it has no editor for to the system', async () => {
      withProject()
      const { openFile } = install({ '': [folder('Notes')], Notes: [file('brief.txt', 'Notes')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('Notes'))
      await userEvent.dblClick(await screen.findByText('brief.txt'))

      await waitFor(() => expect(openFile).toHaveBeenCalledWith('Notes/brief.txt'))
      expect(openAsset).not.toHaveBeenCalled()
    })

    /**
     * `null` means « nothing here opens this ». A REJECTION means the question failed, and the
     * two used to arrive as one answer: a `.glb` double-clicked seconds after a download, while
     * the catalogue was busy, went to macOS Preview with nothing said anywhere.
     */
    it('hands nothing to the system when the adoption could not be answered', async () => {
      withProject()
      const { openFile, adopt } = install({ '': [file('car.glb')] })
      adopt.mockRejectedValueOnce(new Error('catalogue busy'))

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('car.glb'))

      await waitFor(() => expect(adopt).toHaveBeenCalledWith('car.glb'))
      expect(openFile).not.toHaveBeenCalled()
      expect(openAsset).not.toHaveBeenCalled()
    })

    // A `.gltf` whose descriptor the project does not list is a file like any other: the
    // studio cannot open what it has no envelope for, and the system might.
    it('does not take a document extension for a document', async () => {
      withProject()
      const { openFile } = install({ '': [file('stray.gltf')] })

      render(<Explorer />)
      await userEvent.dblClick(await screen.findByText('stray.gltf'))

      expect(openDocument).not.toHaveBeenCalled()
      expect(openFile).toHaveBeenCalledWith('stray.gltf')
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
      await within(await listing()).findByText('brief.pdf')
      vi.unstubAllGlobals()

      await expect(
        userEvent.dblClick(within(await listing()).getByText('brief.pdf')),
      ).resolves.toBeUndefined()
    })

    it('opens a folder rather than handing it to the system', async () => {
      withProject()
      const { openFile } = install({ '': [folder('assets')], assets: [file('one.png', 'assets')] })

      render(<Explorer />)
      await userEvent.dblClick(await within(await listing()).findByText('assets'))

      expect(await within(await listing()).findByText('one.png')).toBeInTheDocument()
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
      install({ '': [file('a3f1.gltf'), file('other.gltf')] }, [scene])

      render(<Explorer />)
      await screen.findByText('Niveau')

      const marked = (name: string): Element | null | undefined =>
        screen.getByText(name).closest('[role="treeitem"]')?.querySelector('.text-accent-ink')

      // `Niveau` is the document's name; `other.gltf` is a file no descriptor came back for,
      // so it keeps the name the folder gives it.
      expect(marked('Niveau')).toBeInTheDocument()
      expect(marked('other.gltf')).not.toBeInTheDocument()
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

    /**
     * The third thing a settled batch does, and the only conditional one. The panel that lists
     * documents walks the disk rather than a row, so a `.gltf` sent to the trash by another
     * window stays listed until this asks again — and a batch of rushes must NOT pay for it.
     *
     * Counts calls, so it rests on `relist` opening a listing rather than joining one in flight.
     * `listing` lives at module scope in the store and no hook resets it: were a case before this
     * one to leave a listing pending, the second batch would join it and never call again.
     */
    it('lists the documents again only when the batch reached one', async () => {
      withProject()
      let announce = (_outcome: FileOutcome): void => undefined
      const listDocuments = vi.fn(() => Promise.resolve<DocumentDescriptor[]>([]))
      installFakeBridge({
        project: {
          listFolder: () => Promise.resolve([file('one.txt')]),
          onFilesChanged: callback => {
            announce = callback
            return () => undefined
          },
        },
        documents: { list: listDocuments },
      })

      render(<Explorer />)
      await screen.findByText('one.txt')
      // Spelt out rather than captured: the panel lists once on mount, and a count taken from
      // the panel itself would follow it into silence if that ever stopped.
      expect(listDocuments).toHaveBeenCalledTimes(1)

      const moved = { from: 'rushes/a.png', to: 'b/a.png' }
      await act(async () => {
        announce({ done: [moved], refused: [], batch: 'batch-1' })
      })
      expect(listDocuments).toHaveBeenCalledTimes(1)

      const trashed = { from: 'Act 1/opening.gltf', to: '' }
      await act(async () => {
        announce({ done: [trashed], refused: [], batch: 'batch-2' })
      })
      expect(listDocuments).toHaveBeenCalledTimes(2)
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
    const label = await within(await listing()).findByText(name)
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
    await userEvent.click(await within(await listing()).findByText('notes'))
    await userEvent.keyboard('{ArrowRight}')
    await drag('brief.pdf', 'refs')

    expect(moveFiles).toHaveBeenCalledWith(['notes/brief.pdf'], 'refs')
  })

  // What the machine keeps refuses on both sides of the gesture — as what moves, and as what
  // receives. The folders the user was given are picked up like any other.
  it('will not pick up what the machine keeps for itself', async () => {
    withProject()
    useExplorerView.setState({ hidden: true })
    install({ '': [file('.project.json'), folder('assets')] })

    render(<Explorer />)

    expect(await rowFor('.project.json')).not.toHaveAttribute('draggable', 'true')
    expect(await rowFor('assets')).toHaveAttribute('draggable', 'true')
  })

  it('drops nothing into what the machine keeps for itself', async () => {
    withProject()
    useExplorerView.setState({ hidden: true })
    const { moveFiles } = install({ '': [folder('.index'), file('brief.pdf')] })

    render(<Explorer />)
    await drag('brief.pdf', '.index')

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
    await userEvent.click(await within(await listing()).findByText('notes'))
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
    const label = await within(await listing()).findByText(name)
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
    await userEvent.click(await within(await listing()).findByText('notes'))
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

    await userEvent.click(await within(await listing()).findByText('notes'))
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
    await userEvent.click(await within(await listing()).findByText('notes'))
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
    await within(await listing()).findByText('notes')
    // Focused without being clicked, which is the state the first case is about: the panel arms
    // its scope on the focus, and nothing is picked yet. Inside `act`, or the effect that
    // subscribes to the keyboard has not run by the time the key below is pressed.
    await act(async () => screen.getAllByRole('treeitem')[0]?.focus())
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', metaKey: true, shiftKey: true })

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('', 'dossier'))

    await userEvent.click(await within(await listing()).findByText('notes'))
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', metaKey: true, shiftKey: true })

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('notes', 'dossier'))
  })

  /**
   * The blank raises a menu of its own now, and it aims at the project folder — so the right-click
   * has to unpick what was picked, exactly as a press there does. Reported from use: in a project
   * whose rows are all folders, a right-click in the empty space offered nothing at all, and there
   * was no way to make a folder at the root.
   */
  it('aims at the project folder when the blank is right-clicked, whatever was picked', async () => {
    withProject()
    const { newFolder } = install({ '': [folder('notes')] })

    render(<Explorer />)
    await userEvent.click(await within(await listing()).findByText('notes'))

    fireEvent.contextMenu(screen.getByRole('tree').parentElement!)
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', metaKey: true, shiftKey: true })

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('', 'dossier'))
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
    await userEvent.pointer({
      keys: '[MouseRight]',
      target: await within(await listing()).findByText(name),
    })
  }

  it('shows a file in the system file manager', async () => {
    withProject()
    const { revealFile } = install({ '': [file('brief.pdf')] })
    menu.picks('Afficher dans le dossier')

    render(<Explorer />)
    await open('brief.pdf')

    await waitFor(() => expect(revealFile).toHaveBeenCalledWith('brief.pdf'))
  })

  /**
   * The window is about ONE entry, so the row carries the path that was right-clicked — never
   * the selection, which the gestures around it act on.
   */
  it('opens the information window on the entry that was right-clicked', async () => {
    withProject()
    const { openFileInfo } = install({ '': [file('brief.pdf'), file('a.png')] })
    menu.picks('Informations sur le fichier')

    render(<Explorer />)
    await open('brief.pdf')

    await waitFor(() => expect(openFileInfo).toHaveBeenCalledWith('brief.pdf'))
  })

  /**
   * A folder has no type, no dimensions, no fingerprint and no catalogue row: the window would
   * open with three of its four screens missing. Greyed rather than dropped, as every row of
   * this menu is — one that comes and goes cannot be learnt.
   */
  it('offers the information window on a file and greys it on a folder', async () => {
    withProject()
    install({ '': [folder('Notes'), file('brief.pdf')] })

    render(<Explorer />)
    await open('brief.pdf')
    expect(menu.offers('Informations sur le fichier')).toBe(true)

    await open('Notes')
    expect(menu.labels()).toContain('Informations sur le fichier')
    expect(menu.offers('Informations sur le fichier')).toBe(false)
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
   * The folder a project was once laid out by is now a folder like any other — that is the whole
   * of the phase, read from the surface it changes. What the catalogue points at follows through
   * `repath`, so nothing is orphaned by the gesture the menu now offers.
   */
  it('offers every gesture on the folders a project used to be laid out by', async () => {
    withProject()
    install({ '': [folder('assets')] })

    render(<Explorer />)
    await open('assets')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(true))
    expect(menu.offers('Mettre à la corbeille')).toBe(true)
  })

  /**
   * What the dot toggle made reachable: `.project.json` sits under no folder of the studio, so
   * every gesture was offered on it and every one refused afterwards by the main process. The
   * panel greys out exactly what the disk will refuse, or it promises something it cannot do.
   */
  it('greys every gesture out on what the studio keeps under a dot', async () => {
    withProject()
    useExplorerView.setState({ hidden: true })
    install({ '': [file('.project.json')] })

    render(<Explorer />)
    await open('.project.json')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(false))
    expect(menu.offers('Mettre à la corbeille')).toBe(false)
    expect(menu.offers('Dupliquer')).toBe(false)
    expect(menu.offers('Couper')).toBe(false)
  })

  /**
   * The one gesture the old identity forbade: a document's file name WAS its id, so renaming an
   * open one orphaned its tab and the next save wrote the old name back beside the new file. The
   * id lives in the envelope now and stays put, so a tab can hold a document being renamed.
   */
  it('renames a document a tab is holding', async () => {
    withProject()
    useDocuments.setState({ documents: { a3f1: scene } })
    install({ '': [file('a3f1.gltf')] }, [scene])

    render(<Explorer />)
    await open('Niveau')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(true))
  })

  it('renames a document through its own channel, never as a plain file', async () => {
    withProject()
    const { renameFile } = install({ '': [file('a3f1.gltf')] }, [scene])
    const rename = vi.fn(() => Promise.resolve({ ...scene, title: 'Décor' }))
    installFakeBridge({
      project: { listFolder: () => Promise.resolve([file('a3f1.gltf')]) },
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
    await userEvent.dblClick(await within(await listing()).findByText('assets'))
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
    await userEvent.dblClick(await within(await listing()).findByText('assets'))
    await open('Boulder.png')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(true))
  })

  /**
   * A picture the user dropped into `assets/` themselves is no row of ours, and no longer needs
   * to be one: `renameFile` carries it as the plain file it is. The catalogue is still asked
   * before the menu is drawn — not to decide WHETHER the gesture is offered, but which of the
   * three channels carries it.
   */
  it('renames a file the catalogue never heard of, wherever it sits', async () => {
    withProject()
    install({ '': [folder('assets')], assets: [file('dropped.png', 'assets')] })

    render(<Explorer />)
    await userEvent.dblClick(await within(await listing()).findByText('assets'))
    await open('dropped.png')

    await waitFor(() => expect(menu.offers('Renommer')).toBe(true))
    expect(menu.offers('Mettre à la corbeille')).toBe(true)
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
    install({ '': [file('a3f1.gltf')] }, [scene])
    menu.picks('Renommer')

    render(<Explorer />)
    await open('Niveau')
    const field = await screen.findByRole('textbox', { name: 'Nom du document' })
    await userEvent.dblClick(field)

    expect(openDocument).not.toHaveBeenCalled()
  })
})

describe('searching the explorer', () => {
  const searching = (term: string): void => {
    useExplorerView.setState({ collection: { ...LIST_ONLY, search: term } })
  }

  /**
   * What the whole second source exists for. The tree reads one folder at a time, so a file
   * three folds down is a file it has never seen — and the chain of folders above the match has
   * to be rebuilt here, `flattenTree` dropping a node whose parent it does not hold.
   */
  it('draws a match nobody had unfolded, and the folders leading to it', async () => {
    withProject()
    searching('ruelle')
    install({ '': [folder('Repérages')] }, [], [], {
      ruelle: [file('ruelle-bleue.png', 'Repérages/Ruelles')],
    })

    render(<Explorer />)

    expect(await screen.findByText('ruelle-bleue.png')).toBeInTheDocument()
    expect(screen.getByText('Repérages')).toBeInTheDocument()
    expect(screen.getByText('Ruelles')).toBeInTheDocument()
  })

  /**
   * The field is drawn INSIDE the panel, under its title row: a word that matches nothing would
   * otherwise take the field it was typed in off the screen, leaving no way back to the folder.
   * It is also why the bar is not in the title row at all — measured on the home's left column,
   * the field was 76 px wide there.
   */
  it('says so when nothing answers to the word, and keeps the field on screen', async () => {
    withProject()
    searching('licorne')
    install({ '': [folder('Repérages')] })

    render(<Explorer />)

    expect(await screen.findByText(/Aucun fichier de ce projet/)).toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('licorne')
  })

  // The bar and the tree are one panel: what is typed reaches the second through the store.
  it('narrows the tree from the field under its title', async () => {
    withProject()
    install({ '': [folder('Repérages')] })

    render(<Explorer />)
    await userEvent.type(await screen.findByRole('searchbox'), 'ruelle')

    expect(useExplorerView.getState().collection.search).toBe('ruelle')
  })

  /** The lazy source comes back untouched — it is the one the panel never stopped holding. */
  it('puts the folders back when the search is left', async () => {
    withProject()
    searching('ruelle')
    install({ '': [folder('Repérages')] }, [], [], {
      ruelle: [file('ruelle-bleue.png', 'Repérages/Ruelles')],
    })

    render(<Explorer />)
    await screen.findByText('ruelle-bleue.png')
    act(() => searching(''))

    expect(await screen.findByText('Repérages')).toBeInTheDocument()
    expect(screen.queryByText('ruelle-bleue.png')).not.toBeInTheDocument()
  })

  /**
   * Shown, and only shown: what a dot hides is refused by every gesture on both sides
   * (`filePlan.test.ts`). Which entries come back is the main process's answer, so what is read
   * here is that the panel asked for them.
   */
  it('asks the folder for what a dot hides once the reader wants it', async () => {
    withProject()
    useExplorerView.setState({ hidden: true })
    const { listFolder } = install({ '': [file('.project.json')] })

    render(<Explorer />)

    await waitFor(() => expect(listFolder).toHaveBeenCalledWith('', true))
  })
})

describe('the explorer read by domain', () => {
  const byDomain = (): void => {
    useExplorerView.setState({ mode: 'domain' })
  }

  const project = [
    file('ruelle.png', 'Repérages'),
    file('toit.png', 'Repérages'),
    file('notes.pdf'),
  ]

  /**
   * The second reading of one folder: where the tree answers « where does this sit », this
   * answers « what does this project hold ». The count is what a reader comes here for.
   */
  it('groups every file of the project by what it is', async () => {
    withProject()
    byDomain()
    install({ '': [folder('Repérages')] }, [], [], {}, project)

    render(<Explorer />)

    expect(await screen.findByText('Image')).toBeInTheDocument()
    expect(screen.getByText('Autre')).toBeInTheDocument()
    expect(screen.getByText('ruelle.png')).toBeInTheDocument()
    expect(screen.getByText('notes.pdf')).toBeInTheDocument()
    // Two pictures under one heading, one file under the other.
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  /**
   * The whole reason the catalogue is asked at all: an extension cannot tell an albedo from a
   * normal map, and a row that has been corrected files the picture where it belongs.
   */
  it('files a picture where the catalogue says, not where its extension does', async () => {
    withProject()
    byDomain()
    install(
      { '': [folder('Repérages')] },
      [],
      [
        {
          id: 'asset_1',
          name: 'Ruelle',
          type: 'texture',
          location: 'local',
          path: 'Repérages/ruelle.png',
          tags: [],
          createdAt: '2026-08-17T10:00:00.000Z',
        },
      ],
      {},
      project,
    )

    render(<Explorer />)

    expect(await screen.findByText('Texture')).toBeInTheDocument()
  })

  /**
   * A `.gltf` and a `.glb` are both filed under Maillage, and one of them opens in the studio
   * where the other is a source it reads. The row already says which: a document is drawn by its
   * TITLE and wears its space's glyph, off the same table the rail and the asset menu read,
   * where a plain file keeps its file name and the generic one. That is the distinction, drawn
   * in the vocabulary the whole studio already uses — a word "document" beside it would be a
   * second one, on the narrowest column the studio has.
   */
  it('tells a document from a source filed under the same domain', async () => {
    withProject()
    byDomain()
    const filed = { ...scene, path: 'Acte 1/a3f1.gltf' }
    install({ '': [folder('Acte 1')] }, [filed], [], {}, [
      file('a3f1.gltf', 'Acte 1'),
      file('chaise.glb', 'Acte 1'),
    ])

    render(<Explorer />)

    // The document by its title, the source by its file name.
    expect(await screen.findByText('Niveau')).toBeInTheDocument()
    expect(screen.getByText('chaise.glb')).toBeInTheDocument()
    expect(within(await listing()).queryByText('a3f1.gltf')).not.toBeInTheDocument()
  })

  /** A source needs none: its own name IS the directory entry, extension and all. */
  it('says which format a document is written in, beside its name', async () => {
    withProject()
    byDomain()
    const filed = { ...scene, path: 'Acte 1/Niveau.gltf' }
    install({ '': [folder('Acte 1')] }, [filed], [], {}, [
      file('Niveau.gltf', 'Acte 1'),
      file('chaise.glb', 'Acte 1'),
    ])

    render(<Explorer />)

    expect(await screen.findByText('.gltf')).toBeInTheDocument()
    expect(screen.queryByText('.glb')).not.toBeInTheDocument()
  })

  /**
   * A document written before the file was named after it wears a uuid and shows its TITLE.
   * `Niveau .gltf` would then name no file at all — the row would send a reader looking for one.
   */
  it('leaves the extension off a document whose file is not named after it', async () => {
    withProject()
    byDomain()
    const filed = { ...scene, path: 'Acte 1/a3f1.gltf' }
    install({ '': [folder('Acte 1')] }, [filed], [], {}, [file('a3f1.gltf', 'Acte 1')])

    render(<Explorer />)

    expect(await screen.findByText('Niveau')).toBeInTheDocument()
    expect(screen.queryByText('.gltf')).not.toBeInTheDocument()
  })

  /** A domain names files rather than holding a place: nothing can be selected or written there. */
  it('folds a domain shut rather than picking it', async () => {
    withProject()
    byDomain()
    install({ '': [folder('Repérages')] }, [], [], {}, project)

    render(<Explorer />)
    await userEvent.click(await screen.findByText('Autre'))

    expect(useSelection.getState().selection.kind).toBe('none')
    await userEvent.dblClick(screen.getByText('Autre'))
    await waitFor(() => expect(screen.queryByText('notes.pdf')).not.toBeInTheDocument())
  })

  // Leaving a reading must not cost the other one: the tree is the source the panel never
  // stopped holding, and it comes back with its folders as they were.
  it('gives the folders back when the reading changes', async () => {
    withProject()
    byDomain()
    install({ '': [folder('Repérages')] }, [], [], {}, project)

    render(<Explorer />)
    await screen.findByText('notes.pdf')
    act(() => useExplorerView.setState({ mode: 'folder' }))

    expect(await screen.findByText('Repérages')).toBeInTheDocument()
    expect(screen.queryByText('Image')).not.toBeInTheDocument()
  })
})

/**
 * The grid is the same folder drawn a second way, so every gesture the tree answers has to answer
 * here too — and not one of them is anything the type checker can say.
 */
describe('the project explorer, as a grid', () => {
  const showGrid = (): void =>
    void useExplorerView.setState({ collection: { ...LIST_ONLY, view: 'grid' } })

  /** The tile, which is what carries the drag: the cell around it belongs to `Collection`. */
  const tileFor = async (name: string): Promise<HTMLElement> => {
    const caption = await within(await listing()).findByText(name)
    const tile = caption.closest('[draggable]')
    if (!(tile instanceof HTMLElement)) throw new Error(`no tile for ${name}`)
    return tile
  }

  /** The blank beside and below the cards — the scroller itself, as the tree's blank is. */
  const blank = (): HTMLElement => {
    const host = screen.getByRole('listbox').parentElement
    if (!(host instanceof HTMLElement)) throw new Error('no blank to aim at')
    return host
  }

  const enter = async (name: string): Promise<void> => {
    await userEvent.dblClick(await screen.findByText(name))
  }

  it('lists what the folder it is showing holds, and nothing deeper', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('brief.pdf')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)

    expect(await within(await listing()).findByText('Images')).toBeInTheDocument()
    expect(within(await listing()).getByText('brief.pdf')).toBeInTheDocument()
    // The tree would draw it under its folder; a grid has no nesting to draw it in.
    expect(screen.queryByText('a.png')).toBeNull()
  })

  it('goes into a folder on a double-click, and shows what it holds', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('brief.pdf')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)
    await enter('Images')

    expect(await screen.findByText('a.png')).toBeInTheDocument()
    expect(within(await listing()).queryByText('brief.pdf')).toBeNull()
  })

  /** A door that shut behind you would make the grid a worse tree, not a second reading of one. */
  it('comes back up by its trail', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('brief.pdf')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)
    await enter('Images')
    await screen.findByText('a.png')

    await userEvent.click(screen.getByRole('button', { name: 'Projet' }))

    expect(await within(await listing()).findByText('brief.pdf')).toBeInTheDocument()
  })

  /**
   * The crumbs name the way UP, which is not the way BACK: they sit at the foot of the panel and
   * were read as a caption rather than as a control.
   */
  it('walks back out of a folder, and forward into it again', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('brief.pdf')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)
    await enter('Images')
    await screen.findByText('a.png')

    await userEvent.click(screen.getByRole('button', { name: 'Précédent' }))
    expect(await within(await listing()).findByText('brief.pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(await screen.findByText('a.png')).toBeInTheDocument()
  })

  it('goes up a level, and offers no way up from the project folder', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('brief.pdf')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)
    await enter('Images')
    await screen.findByText('a.png')

    await userEvent.click(screen.getByRole('button', { name: 'Dossier parent' }))

    expect(await within(await listing()).findByText('brief.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dossier parent' })).toBeDisabled()
  })

  /**
   * The complaint the grid answered with nothing: a folder was a dark square with a little sign
   * in it and a `.jpg` was the same square with another sign, so neither question a grid exists
   * to answer — folder or file, and what is this file about — could be read without the names.
   */
  it('draws a folder as a shape, and a file as a preview of itself', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('facade.jpg')] })

    render(<Explorer />)

    expect((await tileFor('Images')).querySelector('img')).toBeNull()
    // The shape FILLS the tile: a glyph sized in pixels inside a box that is 64 px at one
    // density and 208 at another is the little sign this replaces.
    expect((await tileFor('Images')).querySelector('svg')).toHaveStyle({ width: '100%' })
    // NEITHER wears a frame: the plate and the border bound a picture that fills a square, and
    // a file now draws a silhouette of its own — the thumbnail is cut to it, not framed by it.
    expect((await tileFor('Images')).querySelector('figure')).not.toHaveClass('bg-surface')
    expect((await tileFor('facade.jpg')).querySelector('figure')).not.toHaveClass('bg-surface')

    expect((await tileFor('facade.jpg')).querySelector('img')).toHaveAttribute(
      'src',
      'ia-studio://thumb/facade.jpg',
    )
  })

  // A document is a directory the studio writes, and its glyph names the space that edits it —
  // asking the disk for a preview of one would answer with nothing, slowly.
  it('leaves a document its own glyph rather than asking for a preview', async () => {
    withProject()
    showGrid()
    install({ '': [file('a3f1.ora')] }, [picture])

    render(<Explorer />)

    expect((await tileFor('Planche')).querySelector('img')).toBeNull()
  })

  /**
   * The trap this closes, and it was signalled as latent the day before the previews existed:
   * `EntryCard` refused any drag whose target was not the card itself, and an `<img>` is natively
   * draggable — so every previewed file became a file that could no longer be moved.
   */
  it('moves a tile picked up BY ITS PICTURE, which is what the browser drags from', async () => {
    withProject()
    showGrid()
    const { moveFiles } = install({ '': [folder('Images'), file('facade.jpg')] })

    render(<Explorer />)
    const picture = (await tileFor('facade.jpg')).querySelector('img')
    const data = dragTransfer()
    fireEvent.dragStart(picture!, { dataTransfer: data })
    fireEvent.drop(await tileFor('Images'), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['facade.jpg'], 'Images')
  })

  /**
   * At the FOOT of the panel, under the rows: the trail says where the listing came from, and a
   * reader looks at it after the listing. It used to ride in the collection bar, above.
   */
  it('draws the trail below the rows rather than above them', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images')] })

    render(<Explorer />)
    const trail = await screen.findByRole('navigation', { name: 'Dossier affiché' })

    expect((await tileFor('Images')).compareDocumentPosition(trail)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('moves a tile dropped on a folder into it', async () => {
    withProject()
    showGrid()
    const { moveFiles } = install({ '': [folder('notes'), file('brief.pdf')] })

    render(<Explorer />)
    const data = dragTransfer()
    fireEvent.dragStart(await tileFor('brief.pdf'), { dataTransfer: data })
    fireEvent.drop(await tileFor('notes'), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['brief.pdf'], 'notes')
  })

  /**
   * The blank means the folder ON SCREEN, not the top of the project. Asserted from inside a
   * folder for that reason alone: at the root the two answers are the same string, and a wiring
   * that aimed at the root would pass a test written there.
   */
  it('aims a drop on the blank at the folder being shown', async () => {
    withProject()
    showGrid()
    const { moveFiles } = install({
      '': [folder('Images')],
      Images: [folder('Rendus', 'Images'), file('a.png', 'Images')],
    })

    render(<Explorer />)
    await enter('Images')

    const data = dragTransfer()
    fireEvent.dragStart(await tileFor('a.png'), { dataTransfer: data })
    fireEvent.drop(blank(), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['Images/a.png'], 'Images')
  })

  /**
   * The fifth silence, which only the grid can reach: `explorer.empty` answers for a project that
   * would not be READ, which is what an empty tree means. Gone down into a folder that merely holds
   * nothing, it reported the disk as unreadable.
   */
  it('says an empty folder is empty, not that the project could not be read', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Vide')], Vide: [] })

    render(<Explorer />)
    await enter('Vide')

    expect(await screen.findByText(/ne contient rien/)).toBeInTheDocument()
    expect(screen.queryByText(/n’a pas pu être lu/)).toBeNull()
  })

  /**
   * Every gesture of this panel acts on the SELECTION, so a file left picked in the folder one has
   * just left is a ⌘⌫ that trashes something nobody can see. The tree cannot reach this: what is
   * picked there is on screen by construction.
   */
  it('unpicks what was held when it changes folder', async () => {
    withProject()
    showGrid()
    const { trashFiles } = install({
      '': [folder('Images'), file('brief.pdf')],
      Images: [file('a.png', 'Images')],
    })

    render(<Explorer />)
    await userEvent.click(await within(await listing()).findByText('brief.pdf'))
    await enter('Images')
    await screen.findByText('a.png')

    fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace', metaKey: true })

    await waitFor(() => expect(screen.getByText('a.png')).toBeInTheDocument())
    expect(trashFiles).not.toHaveBeenCalled()
  })

  /** An empty folder with no card to aim at would otherwise be a dead end with no way to fill it. */
  it('still makes a folder from the blank of an empty one', async () => {
    withProject()
    showGrid()
    const { newFolder } = install({ '': [folder('Vide')], Vide: [] })

    render(<Explorer />)
    await enter('Vide')
    await screen.findByText(/ne contient rien/)

    menu.picks('Nouveau dossier')
    fireEvent.contextMenu(screen.getByText(/ne contient rien/))

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('Vide', 'dossier'))
  })

  /**
   * A search draws no trail, so nothing on screen names the folder walked into before it. A blank
   * that still meant that folder moved a result into a place the user could not see.
   */
  it('aims the blank at the project folder once a search has flattened the grid', async () => {
    withProject()
    showGrid()
    const { moveFiles } = install(
      { '': [folder('Images')], Images: [file('a.png', 'Images')] },
      [],
      [],
      { png: [file('a.png', 'Images')] },
    )

    render(<Explorer />)
    await enter('Images')
    await screen.findByText('a.png')

    act(() =>
      useExplorerView.setState({ collection: { ...LIST_ONLY, view: 'grid', search: 'png' } }),
    )
    await screen.findByText('a.png')

    const data = dragTransfer()
    fireEvent.dragStart(await tileFor('a.png'), { dataTransfer: data })
    fireEvent.drop(blank(), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['Images/a.png'], '')
  })

  /**
   * The grid reads the tree's nodes, and a reload keeps only the root and what is UNFOLDED. A
   * folder closed in the list view leaves the grid on one that is about to empty itself, trail
   * still naming it — a full folder shown as empty, without a word.
   */
  it('falls back to the project folder when the one it shows is folded away', async () => {
    withProject()
    showGrid()
    install({ '': [folder('Images'), file('brief.pdf')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)
    await enter('Images')
    await screen.findByText('a.png')

    act(() => useExplorerView.setState({ collection: { ...LIST_ONLY, view: 'list' } }))
    await userEvent.click(await within(await listing()).findByText('Images'))
    await userEvent.keyboard('{ArrowLeft}')
    act(() => useExplorerView.setState({ collection: { ...LIST_ONLY, view: 'grid' } }))

    expect(await within(await listing()).findByText('brief.pdf')).toBeInTheDocument()
  })

  /**
   * Every command acts on the selection, and navigating clears it — so the anchor says « the
   * project folder » while the user is looking at something else. ⌘V wrote at the root.
   */
  it('pastes into the folder it is showing, not where the anchor points', async () => {
    withProject()
    showGrid()
    const { pasteFiles } = install({
      '': [folder('Images'), file('brief.pdf')],
      Images: [file('a.png', 'Images')],
    })

    render(<Explorer />)
    await userEvent.click(await within(await listing()).findByText('brief.pdf'))
    fireEvent.keyDown(window, { key: 'c', code: 'KeyC', metaKey: true })
    await enter('Images')
    await screen.findByText('a.png')

    fireEvent.keyDown(window, { key: 'v', code: 'KeyV', metaKey: true })

    await waitFor(() => expect(pasteFiles).toHaveBeenCalledWith(['brief.pdf'], 'Images', false))
  })

  /** Same question of the menu, which is how a folder is made where the user is looking. */
  it('makes a new folder in the folder being shown, from the blank', async () => {
    withProject()
    showGrid()
    const { newFolder } = install({ '': [folder('Images')], Images: [file('a.png', 'Images')] })

    render(<Explorer />)
    await enter('Images')
    await screen.findByText('a.png')

    menu.picks('Nouveau dossier')
    fireEvent.contextMenu(blank())

    await waitFor(() => expect(newFolder).toHaveBeenCalledWith('Images', 'dossier'))
  })

  it('raises a tile’s own menu on a right-click, asking the catalogue first', async () => {
    withProject()
    showGrid()
    install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    fireEvent.contextMenu(await tileFor('brief.pdf'))

    await waitFor(() => expect(menu.labels()).toContain('Renommer'))
  })

  /**
   * The file stack belongs to the PANEL, not to a row: the menu raised on the blank and the one
   * raised on a tile end on the same two gestures, greyed alike while there is nothing to take
   * back. Read from BOTH here, which is what lets the two lists share one helper.
   */
  it('ends both menus on the file stack, greyed while it holds nothing', async () => {
    withProject()
    showGrid()
    install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    const tile = await tileFor('brief.pdf')
    fireEvent.contextMenu(blank())

    await waitFor(() => expect(menu.labels()).toContain('Annuler'))
    expect(menu.labels()).toContain('Rétablir')
    expect(menu.offers('Annuler')).toBe(false)
    expect(menu.offers('Rétablir')).toBe(false)

    fireEvent.contextMenu(tile)

    await waitFor(() => expect(menu.labels()).toContain('Annuler'))
    expect(menu.labels()).toContain('Rétablir')
    expect(menu.offers('Annuler')).toBe(false)
    expect(menu.offers('Rétablir')).toBe(false)
  })

  /** Three tiles carried together have to arrive together, as three rows do. */
  it('carries the whole selection when one of its tiles is dragged', async () => {
    withProject()
    showGrid()
    const { moveFiles } = install({ '': [folder('notes'), file('a.png'), file('b.png')] })

    // One session for the whole gesture: the modifier is held across two clicks, and the direct
    // API opens a fresh one per call — which drops the key between them.
    const user = userEvent.setup()

    render(<Explorer />)
    await user.click(await screen.findByText('a.png'))
    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('b.png'))
    await user.keyboard('{/Meta}')

    const data = dragTransfer()
    fireEvent.dragStart(await tileFor('b.png'), { dataTransfer: data })
    fireEvent.drop(await tileFor('notes'), { dataTransfer: data })

    expect(moveFiles).toHaveBeenCalledWith(['a.png', 'b.png'], 'notes')
  })

  /** Both sides of the gesture, as the tree refuses both: what the machine keeps is shown, not moved. */
  it('will not pick up what the studio keeps for itself', async () => {
    withProject()
    showGrid()
    useExplorerView.setState({ hidden: true })
    install({ '': [file('.project.json'), file('brief.pdf')] })

    render(<Explorer />)

    expect(await tileFor('.project.json')).toHaveAttribute('draggable', 'false')
    expect(await tileFor('brief.pdf')).toHaveAttribute('draggable', 'true')
  })

  it('refuses a folder the studio keeps for itself as a drop target', async () => {
    withProject()
    showGrid()
    useExplorerView.setState({ hidden: true })
    const { moveFiles } = install({ '': [folder('.index'), file('brief.pdf')] })

    render(<Explorer />)
    const data = dragTransfer()
    fireEvent.dragStart(await tileFor('brief.pdf'), { dataTransfer: data })
    fireEvent.drop(await tileFor('.index'), { dataTransfer: data })

    expect(moveFiles).not.toHaveBeenCalled()
  })

  /** Cut, and on its way out — the file is still there and still opens until a paste spends it. */
  it('dims a tile that has been cut', async () => {
    withProject()
    showGrid()
    install({ '': [file('a.png')] })

    render(<Explorer />)
    await userEvent.click(await screen.findByText('a.png'))
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX', metaKey: true })

    await waitFor(async () => expect(await tileFor('a.png')).toHaveClass('opacity-50'))
  })

  it('renames a tile in place', async () => {
    withProject()
    showGrid()
    const { renameFile } = install({ '': [file('brief.pdf')] })

    render(<Explorer />)
    menu.picks('Renommer')
    fireEvent.contextMenu(await tileFor('brief.pdf'))

    const field = await screen.findByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, 'resume.pdf{Enter}')

    expect(renameFile).toHaveBeenCalledWith('brief.pdf', 'resume.pdf')
  })

  /**
   * The gesture the shelf moved next door for. The grid and the tree take the SAME object, so
   * these two cases and the two above them are one behaviour read in two views — and the third
   * one is what says a file is not a place.
   */
  describe('an asset dragged in from the shelf', () => {
    const shelfAsset: Asset = {
      id: 'asset_moss',
      name: 'moss.png',
      type: 'image',
      location: 'local',
      path: 'Images/moss.png',
      tags: [],
      createdAt: '2026-08-17T10:00:00.000Z',
    }

    const carrying = (): DataTransfer => {
      const data = dragTransfer()
      startAssetDrag({ dataTransfer: data }, shelfAsset)
      return data
    }

    const rowFor = async (name: string): Promise<HTMLElement> => {
      const row = (await within(await listing()).findByText(name)).closest('[role="treeitem"]')
      if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`)
      return row
    }

    beforeEach(() => {
      useAssets.setState({ items: [shelfAsset] })
    })

    it('lands its file in the folder tile it was dropped on', async () => {
      withProject()
      showGrid()
      const { moveFiles } = install({ '': [folder('Croquis')] })

      render(<Explorer />)
      fireEvent.drop(await tileFor('Croquis'), { dataTransfer: carrying() })

      await waitFor(() => expect(moveFiles).toHaveBeenCalledWith(['Images/moss.png'], 'Croquis'))
    })

    it('lands it in the folder on screen when it is dropped on the blank', async () => {
      withProject()
      showGrid()
      const { moveFiles } = install({
        '': [folder('Croquis')],
        Croquis: [file('note.txt', 'Croquis')],
      })

      render(<Explorer />)
      await enter('Croquis')
      await screen.findByText('note.txt')

      fireEvent.drop(blank(), { dataTransfer: carrying() })

      await waitFor(() => expect(moveFiles).toHaveBeenCalledWith(['Images/moss.png'], 'Croquis'))
    })

    // An asset lands IN a place, and a file is not one — the tile takes no outline and no drop.
    it('is refused by a file', async () => {
      withProject()
      showGrid()
      const { moveFiles } = install({ '': [file('brief.pdf')] })

      render(<Explorer />)
      fireEvent.drop(await tileFor('brief.pdf'), { dataTransfer: carrying() })

      await waitFor(() => expect(moveFiles).not.toHaveBeenCalled())
    })

    it('lands its file in the folder ROW it was dropped on, the list reading alike', async () => {
      withProject()
      const { moveFiles } = install({ '': [folder('Croquis')] })

      render(<Explorer />)
      fireEvent.drop(await rowFor('Croquis'), { dataTransfer: carrying() })

      await waitFor(() => expect(moveFiles).toHaveBeenCalledWith(['Images/moss.png'], 'Croquis'))
    })
  })
})
