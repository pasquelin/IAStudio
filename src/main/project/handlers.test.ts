import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor, DocumentKind, DocumentWrite } from '@shared/domain/document'
import type { FileOutcome } from '@shared/domain/fileOp'
import { IDLE_RESCAN } from '@shared/domain/project'
import { noContext } from '@shared/domain/projectContext'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { glbFile, glbWearing } from '@main/assets/glb-fixtures'
import { ownFileOf } from '@main/assets/protocol'
import { createTextureExtraction } from '@main/assets/textureExtraction'
import { invoke, openWindow, resetHandlers } from '@main/ipc/testHarness'
import { pngBytes } from '@main/media/png-fixtures'
import { memoryCatalog } from './catalog-fixtures'
import { registerProjectHandlers, type ProjectHandlerDeps } from './handlers'
import { ProjectOpenError, type FolderVerdict, type ProjectOpenFailure } from './store'
import type { AsyncCatalog } from './catalogClient'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

const PROJECT = '/Users/someone/Films/Reel'

const MANIFEST = { version: 1, name: 'Reel', createdAt: '', updatedAt: '' }

const RENAMED = { path: PROJECT, manifest: { ...MANIFEST, name: 'Summer' } }

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'A001',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

/** A project store answering for a real folder — what a handler reading a file off disk needs. */
function projectAt(root: string, catalog?: AsyncCatalog): ProjectHandlerDeps['project'] {
  return {
    create: vi.fn(),
    open: vi.fn(),
    current: () => ({ path: root, manifest: MANIFEST }),
    path: () => root,
    catalog: () => catalog,
    touch: vi.fn(),
    settled: vi.fn(async () => undefined),
    close: vi.fn(),
  } as unknown as ProjectHandlerDeps['project']
}

/** Every gesture answering "nothing happened", which each suite overrides as it needs. */
function emptyFileOps(): ProjectHandlerDeps['files'] {
  const nothing = async (): Promise<FileOutcome> => ({ done: [], refused: [], batch: 'batch-1' })

  return {
    rename: vi.fn(nothing),
    move: vi.fn(nothing),
    duplicate: vi.fn(nothing),
    createFolder: vi.fn(nothing),
    trash: vi.fn(nothing),
    undo: vi.fn(nothing),
    redo: vi.fn(nothing),
    can: vi.fn(() => ({ undo: false, redo: false })),
    renameAsset: vi.fn(async () => undefined),
    renameAssetToCaption: vi.fn(async () => undefined),
  }
}

function deps(catalog: AsyncCatalog, overrides: Partial<ProjectHandlerDeps> = {}) {
  const merged = { ...base(catalog), ...overrides }

  return {
    ...merged,
    // The real one unless a case hands its own: the channel is a thin wrapper over it now, so a
    // stub here would leave every case about a model's pictures asserting nothing.
    extractTextures:
      overrides.extractTextures ??
      createTextureExtraction({
        fileOf: source => ownFileOf(merged.project.path(), source),
        search: query => catalog.search(query),
        write: (request, bytes) => merged.assets.importFromBytes(request, bytes),
        newAssetId: merged.newAssetId,
        record: merged.record,
      }),
  }
}

function base(catalog: AsyncCatalog) {
  return {
    project: {
      create: vi.fn(),
      // Blank by default: the folder a test says nothing about is one nothing stands in the way
      // of, so a test that cares about a verdict is the one that sets it.
      inspect: vi.fn(async () => 'blank'),
      open: vi.fn(),
      current: () => null,
      path: () => PROJECT,
      catalog: () => catalog,
      touch: vi.fn(),
      settled: vi.fn(async () => undefined),
      close: vi.fn(),
    } as unknown as ProjectHandlerDeps['project'],
    record: vi.fn(),
    assets: {} as ProjectHandlerDeps['assets'],
    newAssetId: () => 'asset-new',
    // Untouched by the channels under test, which read the catalogue and show a file.
    documents: {
      list: vi.fn(async () => []),
      read: vi.fn(async () => null),
      write: vi.fn((): Promise<DocumentWrite> => Promise.resolve('written')),
      remove: vi.fn(async () => undefined),
      rename: vi.fn(
        async (id: string, kind: DocumentKind, title: string): Promise<DocumentDescriptor> => ({
          id,
          kind,
          title,
          workspace: '3d',
          path: `documents/${title}.gltf`,
        }),
      ),
    },
    reveal: vi.fn(),
    // Present by default: a folder that has gone is the case a test says so itself.
    exists: vi.fn(() => true),
    folder: {
      list: vi.fn(async () => []),
      search: vi.fn(async () => []),
      walk: vi.fn(async () => []),
      names: vi.fn(async () => []),
    },
    // Answers an empty batch by default: what a channel DOES with an outcome is what these
    // suites are about, and `fileOps.test.ts` is where the outcome itself is settled.
    files: emptyFileOps(),
    // Idle: a window may watch a pass and call one off, and no channel here starts one.
    reconciler: { request: vi.fn(() => false), stop: vi.fn(), state: () => IDLE_RESCAN },
    // Empty: a project carrying no context is the ordinary one, and `context.test.ts` is where
    // the file itself is settled.
    context: { read: vi.fn(async () => noContext()), write: vi.fn(async () => noContext()) },
    // An empty string is what `shell.openPath` answers when the system took the file.
    openInSystem: vi.fn(async () => ''),
    // Cancel: the safe answer, so a test that does not care about the dialog cannot destroy
    // anything by not caring.
    askUser: vi.fn(async () => 2),
  }
}

describe('project handlers', () => {
  let catalog: AsyncCatalog

  beforeEach(() => {
    resetHandlers()
    vi.clearAllMocks()
    catalog = memoryCatalog()
    onTestFinished(catalog.close)
  })

  // Same silence as opening, reached by the explorer's own "create a project" button: nothing
  // on the renderer side watches `createPicked` either.
  describe('creating a project in a folder that will not take one', () => {
    const refusing = (): ProjectHandlerDeps => {
      const injected = deps(catalog)
      injected.project.create = vi.fn(() => Promise.reject(new Error('EACCES')))
      return injected
    }

    it('says so in the journal', async () => {
      const injected = refusing()
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectCreate, PROJECT)).rejects.toThrow()

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.projectNotCreated',
      })
    })

    // An argument this channel refuses is not a sentence about the folder — the same line
    // `openFailureKey` draws for opening.
    it('says nothing about a folder when it is the argument that was refused', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectCreate, '')).rejects.toThrow()

      expect(injected.project.create).not.toHaveBeenCalled()
      expect(injected.record).not.toHaveBeenCalled()
    })

    it('says nothing when the folder takes one', async () => {
      const injected = deps(catalog)
      injected.project.create = vi.fn(() => Promise.resolve({ path: PROJECT, manifest: MANIFEST }))
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectCreate, PROJECT)).resolves.toBeDefined()

      expect(injected.record).not.toHaveBeenCalled()
    })
  })

  describe('creating a project from the folder that was chosen', () => {
    /**
     * Registered on the spot, with the verdict the chosen folder would give and the button the
     * user would press. Both before registering: the handlers capture `askUser` by value, so a
     * test that set it afterwards would silently keep the default.
     */
    const creating = (verdict: FolderVerdict = 'blank', answer = 0): ProjectHandlerDeps => {
      const injected = deps(catalog)
      injected.project.inspect = vi.fn(async () => verdict)
      injected.project.create = vi.fn(async () => ({ path: PROJECT, manifest: MANIFEST }))
      injected.project.open = vi.fn(async () => ({ path: PROJECT, manifest: MANIFEST }))
      injected.askUser = vi.fn(async () => answer)
      registerProjectHandlers(injected)
      return injected
    }

    it('names the project after the folder, and lays it inside that folder', async () => {
      const injected = creating()

      await invoke(CHANNELS.projectCreate, '/Users/someone/Mes Projets/Bande-annonce')

      expect(injected.project.create).toHaveBeenCalledWith(
        '/Users/someone/Mes Projets/Bande-annonce',
        'Bande-annonce',
      )
    })

    // The root of a volume has no name to give, and a nameless project is a row nobody can find.
    it('turns away a folder with no name of its own', async () => {
      const injected = creating()

      await expect(invoke(CHANNELS.projectCreate, '/')).rejects.toThrow()

      expect(injected.project.create).not.toHaveBeenCalled()
    })

    // Creating again would stamp a fresh `createdAt` on a folder that has been worked in, and
    // hand its catalogue a new identity.
    it('opens a folder that is already a project instead of writing over it', async () => {
      const injected = creating('project')

      await expect(invoke(CHANNELS.projectCreate, PROJECT)).resolves.toBeDefined()

      expect(injected.project.open).toHaveBeenCalledWith(PROJECT)
      expect(injected.project.create).not.toHaveBeenCalled()
      expect(injected.record).not.toHaveBeenCalled()
    })

    // Raised by `inspect` rather than answered, like every other folder that cannot serve.
    it('says which mistake it was when the folder sits inside another project', async () => {
      const injected = creating()
      injected.project.inspect = vi.fn(() => Promise.reject(new ProjectOpenError('nested')))

      await expect(invoke(CHANNELS.projectCreate, PROJECT)).rejects.toThrow()

      expect(injected.project.create).not.toHaveBeenCalled()
      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.projectNested',
      })
    })

    describe('when the folder already holds files of its own', () => {
      it('asks first, and writes nothing when the answer is no', async () => {
        // 0 is the dialog's cancel button, which is also what a dismissed dialog answers.
        const injected = creating('occupied', 0)

        // `null`, not a rejection: a cancelled gesture is not a failure, and nothing is journalled.
        await expect(invoke(CHANNELS.projectCreate, PROJECT)).resolves.toBeNull()

        expect(injected.askUser).toHaveBeenCalled()
        expect(injected.project.create).not.toHaveBeenCalled()
        expect(injected.record).not.toHaveBeenCalled()
      })

      it('goes ahead once the answer is yes', async () => {
        const injected = creating('occupied', 1)

        await expect(invoke(CHANNELS.projectCreate, PROJECT)).resolves.toBeDefined()

        expect(injected.project.create).toHaveBeenCalled()
      })
    })
  })

  describe('walking the project folder', () => {
    it('lists the folder that was asked for', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectListFolder, 'assets/img', false)

      expect(injected.folder.list).toHaveBeenCalledWith('assets/img', false)
    })

    /**
     * The reader asks; the main process decides. `.index/` and `.project.json` are shown on this
     * flag and stay refused by every gesture — `filePlan.test.ts` holds that half.
     */
    it('shows what a dot hides only when the window asked for it', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectListFolder, '', true)

      expect(injected.folder.list).toHaveBeenCalledWith('', true)
    })

    it('searches the whole folder, which is the source the tree cannot be', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectSearchFolder, 'ruelle', false)

      expect(injected.folder.search).toHaveBeenCalledWith('ruelle', false)
    })

    // The one channel where a window names a path of its own, and `join` walks out of the
    // project on every platform. The listing must never be reached at all.
    it('refuses a path that would climb out of the project', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectListFolder, '../..', false)).rejects.toThrow()

      expect(injected.folder.list).not.toHaveBeenCalled()
    })
  })

  describe('the three gestures of the explorer menu', () => {
    it('shows a file in the system file manager, under the project folder', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectRevealFile, 'assets/img/one.png')

      expect(injected.reveal).toHaveBeenCalledWith(join(PROJECT, 'assets/img/one.png'))
    })

    // A name with a separator in it would move the file rather than rename it, which is not what
    // the row says it does.
    it.each(['../escape', 'sub/one.txt', ''])('refuses %s as a new name', async name => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRenameFile, 'notes.txt', name)).rejects.toThrow()

      expect(injected.files.rename).not.toHaveBeenCalled()
    })

    // The destination is the second path these channels take from a window, and it escapes the
    // project exactly as easily as the first.
    it.each(['../escape', '/etc', 'sub\\..\\out'])('refuses %s as a destination', async folder => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectMoveFiles, ['notes.txt'], folder)).rejects.toThrow()

      expect(injected.files.move).not.toHaveBeenCalled()
    })

    it.each([CHANNELS.projectRevealFile, CHANNELS.projectOpenFile])(
      'refuses a path that would climb out of the project on %s',
      async channel => {
        const injected = deps(catalog)
        registerProjectHandlers(injected)

        await expect(invoke(channel, '../../etc/passwd')).rejects.toThrow()

        expect(injected.reveal).not.toHaveBeenCalled()
      },
    )

    it('tells every window what a batch did, so a tree that did not ask still follows', async () => {
      const injected = deps(catalog)
      const outcome: FileOutcome = {
        done: [{ from: 'notes.txt', to: 'refs/notes.txt' }],
        refused: [],
        batch: 'batch-1',
      }
      injected.files.move = vi.fn(async () => outcome)
      const window = openWindow()
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectMoveFiles, ['notes.txt'], 'refs')

      expect(window.sent).toContainEqual({ channel: EVENTS.filesChanged, payload: outcome })
    })

    // A batch that refused everything says nothing to the other windows: nothing moved, and a
    // tree re-reading its folders would find exactly what it already holds.
    it('says how many were refused in the journal, and wakes nobody', async () => {
      const injected = deps(catalog)
      injected.files.move = vi.fn(async (): Promise<FileOutcome> => ({
        done: [],
        refused: [
          { path: 'a.png', reason: 'exists' },
          { path: 'b.png', reason: 'missing' },
        ],
        batch: 'batch-1',
      }))
      const window = openWindow()
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectMoveFiles, ['a.png', 'b.png'], 'refs')

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.filesRefused',
        params: { count: 2 },
      })
      expect(window.sent.map(one => one.channel)).not.toContain(EVENTS.filesChanged)
    })

    // The one gesture undo cannot take back, so it is the one gesture that asks.
    it('asks before trashing a batch, and writes nothing when the answer is no', async () => {
      const injected = deps(catalog)
      injected.askUser = vi.fn(async () => 0)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectTrashFiles, ['a.png', 'b.png'])

      expect(injected.askUser).toHaveBeenCalled()
      expect(injected.files.trash).not.toHaveBeenCalled()
    })

    it('trashes one file without asking, which is where the row was clicked', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectTrashFiles, ['a.png'])

      expect(injected.askUser).not.toHaveBeenCalled()
      expect(injected.files.trash).toHaveBeenCalledWith(['a.png'])
    })

    // One channel, two settings: what the clipboard held is moved when it was cut and copied
    // when it was not, and a second channel would be a second place to keep in step.
    it('pastes by moving when the clipboard was cut, and by copying when it was not', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectPasteFiles, ['a.png'], 'refs', true)
      expect(injected.files.move).toHaveBeenCalledWith(['a.png'], 'refs')

      await invoke(CHANNELS.projectPasteFiles, ['a.png'], 'refs', false)
      expect(injected.files.duplicate).toHaveBeenCalledWith(['a.png'], 'refs')
    })
  })

  /**
   * The name in the manifest, never the folder on disk: `recentProjects`, `storage.lastProject`
   * and every absolute path the catalogue holds are keyed on that folder.
   */
  describe('renaming a project', () => {
    const renaming = (current: string | null, rename = vi.fn(async () => RENAMED)) => {
      const injected = deps(catalog)
      injected.project.rename = rename
      injected.project.current = () =>
        current === null ? null : { path: current, manifest: MANIFEST }
      registerProjectHandlers(injected)
      return { injected, rename }
    }

    it('writes the new name and answers the renamed project', async () => {
      const { rename } = renaming(null)

      await expect(invoke(CHANNELS.projectRename, PROJECT, 'Summer')).resolves.toEqual(RENAMED)

      expect(rename).toHaveBeenCalledWith(PROJECT, 'Summer')
    })

    /**
     * Every window replicates the open project, so the title bar of a second one would go on
     * naming the name that was just replaced.
     */
    it('tells every window, when the renamed project is the one open', async () => {
      const window = openWindow()
      renaming(PROJECT)

      await invoke(CHANNELS.projectRename, PROJECT, 'Summer')

      expect(window.sent).toContainEqual({ channel: EVENTS.projectChanged, payload: RENAMED })
    })

    // The shelf renames projects that are not open, which is most of them: announcing one of
    // those as the project in front would swap the studio out from under whoever renamed it.
    it('tells nobody when it is another project on the shelf', async () => {
      const window = openWindow()
      renaming('/Users/someone/Films/Other')

      await invoke(CHANNELS.projectRename, PROJECT, 'Summer')

      expect(window.sent).toEqual([])
    })

    // The folder can have gone since the shelf last saw it — the same failure opening reports,
    // and the shelf is exactly where a stale row lives.
    it('says so in the journal, and still refuses', async () => {
      const { injected } = renaming(
        PROJECT,
        vi.fn(() => Promise.reject(new Error('read-only disk'))),
      )

      await expect(invoke(CHANNELS.projectRename, PROJECT, 'Summer')).rejects.toThrow()

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.projectNotRenamed',
      })
    })

    // A name is a manifest field, not a path segment: it is parsed, and an empty one would leave
    // a row on the shelf that nothing can be found by.
    it.each(['', '   '])('refuses %o as a name', async name => {
      const { rename } = renaming(PROJECT)

      await expect(invoke(CHANNELS.projectRename, PROJECT, name)).rejects.toThrow()

      expect(rename).not.toHaveBeenCalled()
    })

    it('refuses a folder that is not absolute', async () => {
      const { rename } = renaming(PROJECT)

      await expect(invoke(CHANNELS.projectRename, 'relative/summer', 'Summer')).rejects.toThrow()

      expect(rename).not.toHaveBeenCalled()
    })
  })

  /**
   * The home's shelf points at projects that are NOT open, so this one names a folder outright
   * instead of resolving against the open project.
   */
  describe('showing a recent project folder', () => {
    it('shows the folder it was handed, not one under the open project', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRevealFolder, '/elsewhere/summer')).resolves.toBe(true)

      expect(injected.reveal).toHaveBeenCalledWith('/elsewhere/summer')
      expect(injected.record).not.toHaveBeenCalled()
    })

    /**
     * `showItemInFolder` answers nothing and no-ops in silence, and the shelf lists folders last
     * seen days ago — so a row that reveals a folder gone from the disk was the one gesture of
     * this file that did nothing and explained nothing.
     */
    it('says so in the journal rather than showing nothing, when the folder has gone', async () => {
      const injected = deps(catalog)
      injected.exists = vi.fn(() => false)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRevealFolder, '/elsewhere/summer')).resolves.toBe(false)

      expect(injected.reveal).not.toHaveBeenCalled()
      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.projectNotRevealed',
      })
    })

    // A relative path would resolve against wherever Electron was launched from, which is the
    // very reason `parseProjectPath` demands an absolute one.
    it.each(['', '   ', 'relative/summer'])('refuses %o as a folder', async path => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRevealFolder, path)).rejects.toThrow()

      expect(injected.reveal).not.toHaveBeenCalled()
    })
  })

  /**
   * The one place the studio launches a third-party application. `shell.openPath` answers with
   * a sentence rather than throwing, so the refusal has to be read rather than caught.
   */
  describe('handing a file to the system', () => {
    it('opens it under the project folder, never wherever the renderer says', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectOpenFile, 'notes.pdf')).resolves.toBe(true)

      expect(injected.openInSystem).toHaveBeenCalledWith(join(PROJECT, 'notes.pdf'))
    })

    it('refuses a path that would climb out of the project', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectOpenFile, '../../etc/passwd')).rejects.toThrow()

      expect(injected.openInSystem).not.toHaveBeenCalled()
    })

    // A sentence back is a refusal, and it is the system's own — in the system's language. The
    // journal says ours.
    it('says so in the journal when the system will not take it', async () => {
      const injected = deps(catalog)
      injected.openInSystem = vi.fn(async () => 'no application knows this file')
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectOpenFile, 'notes.pdf')).resolves.toBe(false)

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.fileNotOpened',
      })
    })
  })

  // The renderer's own `openPicked` watches nothing: without a line in the journal, a folder
  // that is not a project failed in silence.
  describe('opening a folder that will not open', () => {
    const failing = (reason: ProjectOpenFailure): ProjectHandlerDeps => {
      const injected = deps(catalog)
      injected.project.open = vi.fn(() => Promise.reject(new ProjectOpenError(reason)))
      return injected
    }

    const said: [ProjectOpenFailure, string][] = [
      ['not-a-project', 'activity.projectNotAProject'],
      ['unreadable', 'activity.projectUnreadable'],
      ['too-new', 'activity.projectTooNew'],
    ]

    it.each(said)('says %s in the journal', async (reason, messageKey) => {
      const injected = failing(reason)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectOpen, PROJECT)).rejects.toThrow()

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey,
      })
    })

    // Rethrown as well as recorded: `open` on the renderer side forgets a folder nothing can
    // open, and it only knows to when the promise rejects.
    it('still lets the failure through', async () => {
      registerProjectHandlers(failing('not-a-project'))

      await expect(invoke(CHANNELS.projectOpen, PROJECT)).rejects.toThrow()
    })

    // Only the named ones: a disk that gave out mid-open is not a sentence about the folder.
    it('says nothing for a failure that is not about the folder', async () => {
      const injected = deps(catalog)
      injected.project.open = vi.fn(() => Promise.reject(new Error('EIO')))
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectOpen, PROJECT)).rejects.toThrow()

      expect(injected.record).not.toHaveBeenCalled()
    })
  })

  /**
   * `updatedAt` is what says when the project last did some work, so it moves when a document
   * lands — and only then: a manifest stamped for a save the disk refused would lie.
   */
  describe('saving a document', () => {
    it('stamps the manifest once the document is written', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.documentWrite, 'doc-1', 'image', { title: 'A', content: '{}' })

      expect(injected.documents.write).toHaveBeenCalled()
      expect(injected.project.touch).toHaveBeenCalled()
    })

    it('leaves the stamp alone when the write failed', async () => {
      const injected = deps(catalog)
      injected.documents.write = vi.fn(() => Promise.reject(new Error('ENOSPC')))
      registerProjectHandlers(injected)

      await expect(
        invoke(CHANNELS.documentWrite, 'doc-1', 'image', { title: 'A', content: '{}' }),
      ).rejects.toThrow()

      expect(injected.project.touch).not.toHaveBeenCalled()
    })
  })

  // The renderer has no filesystem: a path there is only ever text on screen, and handing the
  // window every user's folder layout widens what a compromised dependency could read.
  it('searches without ever handing back where a linked file sits', async () => {
    await catalog.add(asset({ sourcePath: '/Volumes/Rushes/A001.mov' }))
    registerProjectHandlers(deps(catalog))

    const found = await invoke(CHANNELS.assetsSearch, {})

    expect(found).toEqual([expect.not.objectContaining({ sourcePath: expect.anything() })])
    expect(found).toEqual([expect.objectContaining({ name: 'A001' })])
  })

  // Six numbers rather than the catalogue: the home draws a counter per kind, and reading the
  // rows to count them would carry a whole project across the boundary to print six integers.
  it('answers how many of each kind the project holds', async () => {
    await catalog.add(asset())
    await catalog.add(asset({ id: 'asset-2', type: 'image' }))
    registerProjectHandlers(deps(catalog))

    await expect(invoke(CHANNELS.assetsCounts)).resolves.toEqual({
      image: 1,
      video: 1,
      audio: 0,
      mesh: 0,
      texture: 0,
      skybox: 0,
      animation: 0,
    })
  })

  it('shows a linked file where the user actually put it', async () => {
    await catalog.add(asset({ sourcePath: '/Volumes/Rushes/A001.mov' }))
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await expect(invoke(CHANNELS.assetsReveal, 'asset-1')).resolves.toBe(true)
    expect(injected.reveal).toHaveBeenCalledWith('/Volumes/Rushes/A001.mov')
  })

  // Showing someone `.index/proxies/ab12….mp4` in place of the rush they linked is showing
  // them a file they never made.
  it('shows the rush and not the proxy the studio made of it', async () => {
    await catalog.add(
      asset({ sourcePath: '/Volumes/Rushes/A001.mov', proxyPath: '.index/proxies/ab12.mp4' }),
    )
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await invoke(CHANNELS.assetsReveal, 'asset-1')
    expect(injected.reveal).toHaveBeenCalledWith('/Volumes/Rushes/A001.mov')
  })

  it('shows a generated asset inside the project folder', async () => {
    await catalog.add(asset({ id: 'asset-1', type: 'image', path: 'assets/img/one.png' }))
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await invoke(CHANNELS.assetsReveal, 'asset-1')
    expect(injected.reveal).toHaveBeenCalledWith(`${PROJECT}/assets/img/one.png`)
  })

  it('answers no rather than opening anything for an asset with no file', async () => {
    await catalog.add(asset({ location: 'cloud' }))
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await expect(invoke(CHANNELS.assetsReveal, 'asset-1')).resolves.toBe(false)
    expect(injected.reveal).not.toHaveBeenCalled()
  })

  it('answers no for an asset the catalogue does not hold', async () => {
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await expect(invoke(CHANNELS.assetsReveal, 'asset-gone')).resolves.toBe(false)
    expect(injected.reveal).not.toHaveBeenCalled()
  })

  describe('which assets have lost their file', () => {
    it('names the rows the disk no longer answers for, and only those', async () => {
      await catalog.add(asset({ id: 'asset-1', type: 'image', path: 'assets/img/here.png' }))
      await catalog.add(asset({ id: 'asset-2', type: 'image', path: 'assets/img/gone.png' }))
      const injected = deps(catalog)
      injected.exists = (path: string) => path.endsWith('here.png')
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.assetsAbsent, ['asset-1', 'asset-2'])).resolves.toEqual([
        'asset-2',
      ])
    })

    // A cloud-only row is elsewhere, not lost. Marking it would put a warning on the one state
    // that is perfectly fine, and the browser reads this answer to decide what to warn about.
    it('never calls an asset with no file of its own absent', async () => {
      await catalog.add(asset({ id: 'asset-1', location: 'cloud' }))
      const injected = deps(catalog)
      injected.exists = () => false
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.assetsAbsent, ['asset-1'])).resolves.toEqual([])
    })

    // A linked rush lives outside the project, and its own path is what has to be looked at —
    // not a path resolved against a folder it was never in.
    it('looks a linked medium up where the user actually put it', async () => {
      await catalog.add(asset({ id: 'asset-1', sourcePath: '/Volumes/Rushes/A001.mov' }))
      const injected = deps(catalog)
      const asked: string[] = []
      injected.exists = (path: string) => {
        asked.push(path)
        return false
      }
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.assetsAbsent, ['asset-1'])).resolves.toEqual(['asset-1'])
      expect(asked).toEqual(['/Volumes/Rushes/A001.mov'])
    })

    it('says nothing about an id the catalogue does not hold', async () => {
      const injected = deps(catalog)
      injected.exists = () => false
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.assetsAbsent, ['asset-gone'])).resolves.toEqual([])
    })

    it('refuses a list that is not one, rather than passing junk to the catalogue', async () => {
      registerProjectHandlers(deps(catalog))
      await expect(invoke(CHANNELS.assetsAbsent, 'asset-1')).rejects.toThrow()
    })
  })

  it('refuses an identifier that is not one, rather than passing junk to the catalogue', async () => {
    registerProjectHandlers(deps(catalog))
    await expect(invoke(CHANNELS.assetsReveal, '')).rejects.toThrow()
  })

  /**
   * The signature alone does for the guard, but not for the probe both picture handlers now read
   * off the very bytes they write. A `Buffer` because that is what the handler decodes its base64
   * into, and a `Uint8Array` beside it would fail the deep equality on the call.
   */
  const png = (width: number, height: number): Buffer => Buffer.from(pngBytes({ width, height }))

  /**
   * A downloaded model keeps its pictures inside its own file, where nothing in the studio can
   * open them. Taking them out is what makes them assets — and what lets the maps of a model
   * fetched from the library be painted on at all.
   */
  describe('the pictures inside a model', () => {
    const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-new', type: 'texture' })),
      importFromFile: vi.fn(async () => asset({ id: 'asset-new', type: 'texture' })),
      replaceBytes: vi.fn(),
    })

    /**
     * What one call wrote, with the bytes as plain numbers: the reader hands back views ONTO the
     * file it read — a `Buffer`, since that is what `readFile` answers — and a deep equality
     * against a `Uint8Array` compares the two wrappers rather than the pixels.
     */
    const wrote = (assets: ReturnType<typeof backend>, at = 0) => {
      const call: unknown[] = assets.importFromBytes.mock.calls[at] ?? []
      const bytes = call[1]

      return {
        request: call[0],
        bytes: bytes instanceof Uint8Array ? [...bytes] : [],
      }
    }

    /** The model on disk, under a project folder this test owns. */
    async function modelInProject(file: Uint8Array, name = 'Skeleton'): Promise<string> {
      const root = await mkdtemp(join(tmpdir(), 'scenario-extract-'))
      await mkdir(join(root, 'assets/3d'), { recursive: true })
      await writeFile(join(root, 'assets/3d/asset-1.glb'), file)

      await catalog.add(asset({ id: 'asset-1', name, type: 'mesh', path: 'assets/3d/asset-1.glb' }))
      return root
    }

    it('writes each one into the project as a texture of its own', async () => {
      const root = await modelInProject(glbWearing('baseColorTexture', JPEG))
      const assets = backend()
      registerProjectHandlers(
        deps(catalog, { assets, project: projectAt(root, catalog), newAssetId: () => 'asset-new' }),
      )

      await invoke(CHANNELS.assetsExtractTextures, 'asset-1')

      expect(wrote(assets).request).toMatchObject({
        id: 'asset-new',
        type: 'texture',
        // Read here because this is the only place the extracted name reaches: it carries TWO
        // holes, and nothing else in the suite would notice `{{name}} — {{channel}}` going out
        // whole. See `main/no-unfilled-placeholder.test.ts`.
        name: 'Skeleton — Couleur de base',
        // The channel the glTF slot means, so the shelf can badge it and the catalogue answer
        // "which base colours does this project hold".
        map: 'baseColor',
        // `.jpg`, from what the file declares: the bytes are copied, so the name must not lie.
        extension: '.jpg',
        derivedFrom: 'asset-1',
      })
      expect(wrote(assets).bytes).toEqual([...JPEG])
      await rm(root, { recursive: true, force: true })
    })

    /**
     * An import extracts on its own now, and the row is what catches up the models a project held
     * before it did. Both call the same thing, so without this a model imported since would have
     * every one of its pictures doubled by one click.
     */
    it('leaves a model that already has its pictures alone, and answers with them', async () => {
      const root = await modelInProject(glbWearing('baseColorTexture', JPEG))
      await catalog.add(
        asset({ id: 'asset-tex', type: 'texture', derivedFrom: 'asset-1', name: 'Skeleton base' }),
      )
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets, project: projectAt(root, catalog) }))

      const answered = await invoke(CHANNELS.assetsExtractTextures, 'asset-1')

      expect(assets.importFromBytes).not.toHaveBeenCalled()
      expect(answered).toMatchObject([{ id: 'asset-tex' }])
      await rm(root, { recursive: true, force: true })
    })

    /**
     * The catalogue can only answer for what is COMMITTED, and reading a real model then writing
     * its pictures takes seconds: the automatic run and the menu row clicked while it was going
     * both saw a mesh with no derived picture — which it was, for a few seconds more.
     */
    it('shares a run already going rather than extracting the same model twice', async () => {
      const root = await modelInProject(glbWearing('baseColorTexture', JPEG))
      const assets = backend()
      const merged = deps(catalog, {
        assets,
        project: projectAt(root, catalog),
        newAssetId: () => 'asset-new',
      })
      registerProjectHandlers(merged)

      const [first, second] = await Promise.all([
        invoke(CHANNELS.assetsExtractTextures, 'asset-1'),
        invoke(CHANNELS.assetsExtractTextures, 'asset-1'),
      ])

      expect(assets.importFromBytes).toHaveBeenCalledTimes(1)
      expect(second).toEqual(first)
      await rm(root, { recursive: true, force: true })
    })

    // Named as a derived channel is, and in the language the window is in — the two are the same
    // thing on the shelf and must not read as two different notions.
    it('names it after the model and the role it played', async () => {
      const root = await modelInProject(glbWearing('baseColorTexture', JPEG), 'Squelette')
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets, project: projectAt(root, catalog) }))

      await invoke(CHANNELS.assetsExtractTextures, 'asset-1')

      expect(wrote(assets).request).toMatchObject({ name: 'Squelette — Couleur de base' })
      await rm(root, { recursive: true, force: true })
    })

    // Nothing appears on the shelf, so a gesture that says nothing reads as a broken menu row.
    it('says so when the model carries no picture at all', async () => {
      const root = await modelInProject(glbFile({ materials: [{ name: 'bare' }] }))
      const record = vi.fn()
      registerProjectHandlers(
        deps(catalog, { assets: backend(), project: projectAt(root, catalog), record }),
      )

      await expect(invoke(CHANNELS.assetsExtractTextures, 'asset-1')).resolves.toEqual([])
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ messageKey: 'activity.extractedNothing' }),
      )
      await rm(root, { recursive: true, force: true })
    })

    it('counts what it took out in the journal', async () => {
      const root = await modelInProject(glbWearing('baseColorTexture', JPEG))
      const record = vi.fn()
      registerProjectHandlers(
        deps(catalog, { assets: backend(), project: projectAt(root, catalog), record }),
      )

      await invoke(CHANNELS.assetsExtractTextures, 'asset-1')

      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          messageKey: 'activity.extractedTextures',
          params: { count: 1, name: 'Skeleton' },
        }),
      )
      await rm(root, { recursive: true, force: true })
    })

    /**
     * The picture glTF packs two channels into: roughness in green, metalness in blue. The
     * studio stores those apart, so it comes out unlabelled — still openable, still paintable,
     * just not claiming to be a channel it is not. A PNG also answers for its own dimensions.
     */
    it('files a packed picture without a channel, and reads a PNG for its size', async () => {
      const png = pngBytes({ width: 8, height: 4 })
      const root = await modelInProject(glbWearing('metallicRoughnessTexture', png, 'image/png'))
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets, project: projectAt(root, catalog) }))

      await invoke(CHANNELS.assetsExtractTextures, 'asset-1')

      expect(wrote(assets).request).toMatchObject({
        type: 'texture',
        extension: '.png',
        probe: expect.objectContaining({ width: 8, height: 4 }),
      })
      // Neither roughness nor metalness: the picture holds both, and claiming one would label
      // the pixels wrongly.
      expect(wrote(assets).request).not.toHaveProperty('map')
      await rm(root, { recursive: true, force: true })
    })

    // A row whose file the disk no longer has: there is nothing to read the pictures out of.
    it('refuses a model with no file behind it', async () => {
      await catalog.add(asset({ id: 'asset-3', name: 'Ghost', type: 'mesh' }))
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(invoke(CHANNELS.assetsExtractTextures, 'asset-3')).rejects.toThrow()
    })

    // Only a mesh holds pictures inside itself, and the id comes from the renderer.
    it('refuses an asset that is not a model', async () => {
      await catalog.add(asset({ id: 'asset-2', type: 'image', path: 'assets/img/asset-2.png' }))
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(invoke(CHANNELS.assetsExtractTextures, 'asset-2')).rejects.toThrow()
      await expect(invoke(CHANNELS.assetsExtractTextures, 'asset-gone')).rejects.toThrow()
    })
  })

  describe('a channel the renderer computed', () => {
    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-new', type: 'texture' })),
      importFromFile: vi.fn(async () => asset({ id: 'asset-new', type: 'texture' })),
      replaceBytes: vi.fn(),
    })

    /**
     * A channel goes in as a `texture`, which is what puts it under the right facet of the shelf,
     * and carries its `map` so the catalogue can later be asked which normal maps a project holds.
     */
    it('files it as a channel of the project, under a new identifier', async () => {
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets }))

      await invoke(CHANNELS.assetsSaveTexture, {
        name: 'Brique — Normale',
        map: 'normal',
        derivedFrom: 'asset-1',
        png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      })

      expect(assets.importFromBytes).toHaveBeenCalledWith(
        {
          id: 'asset-new',
          name: 'Brique — Normale',
          type: 'texture',
          extension: '.png',
          map: 'normal',
          derivedFrom: 'asset-1',
        },
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      )
    })

    /**
     * A channel is a picture on the shelf, so it owes its reader the dimensions any other one
     * shows. Read from the bytes here, where they are already in hand — a row with no probe left
     * the inspector with nothing to print for half the pictures in a project.
     */
    it('carries the dimensions of the channel it just wrote', async () => {
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets }))

      await invoke(CHANNELS.assetsSaveTexture, {
        name: 'Brique — Normale',
        map: 'normal',
        png: png(2048, 2048),
      })

      expect(assets.importFromBytes).toHaveBeenCalledWith(
        expect.objectContaining({
          probe: { duration: 0, codec: 'png', width: 2048, height: 2048 },
        }),
        expect.anything(),
      )
    })

    it('never hands back where the file sits', async () => {
      const assets = backend()
      assets.importFromBytes = vi.fn(async () =>
        asset({ id: 'asset-new', type: 'texture', sourcePath: '/Users/someone/secret.png' }),
      )
      registerProjectHandlers(deps(catalog, { assets }))

      const saved = await invoke(CHANNELS.assetsSaveTexture, {
        name: 'Brique',
        map: 'normal',
        png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      })

      expect(saved).toEqual(expect.not.objectContaining({ sourcePath: expect.anything() }))
    })

    /** Bytes with no channel are an ordinary picture: this door files textures, and says so. */
    it('refuses a request that names no channel', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: 'Brique',
          png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        }),
      ).rejects.toThrow()
    })

    /** The renderer is the sandboxed side, and this one writes a file to the user's disk. */
    it('refuses a channel it has never heard of', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: 'Brique',
          map: 'displacement',
          png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        }),
      ).rejects.toThrow()
    })

    /** The renderer is sandboxed, and this door writes a file: an unbounded buffer is a partition. */
    it('refuses a payload past the ceiling', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: 'Brique',
          map: 'normal',
          png: new Uint8Array(257 * 1024 * 1024),
        }),
      ).rejects.toThrow()
    })

    /**
     * The bytes are checked, not merely bounded. An encoder that answered with nothing would
     * otherwise be catalogued as a channel, and the tile would show an empty frame for a file
     * that is not a picture — with no way, from there, to read why.
     */
    it('refuses bytes that are not a PNG', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      for (const png of [new Uint8Array(), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])]) {
        await expect(
          invoke(CHANNELS.assetsSaveTexture, { name: 'Brique', map: 'normal', png }),
        ).rejects.toThrow()
      }
    })

    it('refuses a source identifier that is not one', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: 'Brique',
          map: 'normal',
          derivedFrom: '   ',
          png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        }),
      ).rejects.toThrow()
    })

    it('refuses a request with no name to file it under', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: '   ',
          map: 'normal',
          png: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        }),
      ).rejects.toThrow()
    })
  })

  /**
   * The picture an editor sends back, which is what ⌘S calls once the document is on disk.
   *
   * Base64 where its two neighbours carry bytes: `extract.base64` hands back a string, and the
   * decoding belongs on this side — a `Buffer` does not cross the bridge.
   */
  describe('a picture the editor edited', () => {
    const PNG = png(1024, 768)
    const PNG_BASE64 = PNG.toString('base64')

    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-new', type: 'image' })),
      importFromFile: vi.fn(async () => asset({ id: 'asset-new', type: 'image' })),
      replaceBytes: vi.fn(async () => asset({ id: 'asset-1', type: 'image' })),
    })

    /**
     * A catalogue that answers with a picture, because an overwrite now asks it what it is about
     * to replace: the id travels in a JSON envelope inside the project folder, and `replaceBytes`
     * builds its path from the row's own type.
     */
    const holdingPicture = () => ({
      ...catalog,
      find: vi.fn(async () => asset({ id: 'asset-1', type: 'image' })),
    })

    // `replaces` overwrites, which is ⌘S on a tab opened from the shelf. Why it was refused for
    // a while is written where the rule lives: `LayerSurface.fromDocument`.
    it('overwrites the asset the caller names', async () => {
      const assets = backend()
      registerProjectHandlers(deps(holdingPicture(), { assets }))

      await invoke(CHANNELS.assetsSavePicture, {
        replaces: 'asset-1',
        name: 'Gemini 3.1',
        png: PNG_BASE64,
      })

      expect(assets.replaceBytes).toHaveBeenCalledWith('asset-1', PNG, '.png', {
        duration: 0,
        codec: 'png',
        width: 1024,
        height: 768,
      })
      expect(assets.importFromBytes).not.toHaveBeenCalled()
    })

    /**
     * The defect this closes destroyed a file and hid it. A 4112 × 2658 photo overwritten at
     * 1024² kept the probe of the picture that WAS there, so the inspector went on announcing
     * dimensions nothing on disk held — the one reader that could have shown the loss.
     */
    it('carries the dimensions of the bytes it writes, not those it replaces', async () => {
      const assets = backend()
      registerProjectHandlers(deps(holdingPicture(), { assets }))

      await invoke(CHANNELS.assetsSavePicture, {
        replaces: 'asset-1',
        name: 'Gemini 3.1',
        png: png(4112, 2658).toString('base64'),
      })

      expect(assets.replaceBytes).toHaveBeenCalledWith(
        'asset-1',
        expect.anything(),
        '.png',
        expect.objectContaining({ width: 4112, height: 2658 }),
      )
    })

    /**
     * A picture whose header will not read is still written — the bytes are what the user asked
     * to save, and `isPngBytes` already vouched for the signature.
     *
     * No probe is sent, which means `replaceBytes` KEEPS the previous one: it spreads the row it
     * found and only overwrites what it was given. That is the stale probe this lot closed, still
     * open on this one path — and deliberately, because the alternative is a row that claims a
     * picture has no dimensions at all. It is reachable only by bytes that open on a valid PNG
     * signature and then stop, which the studio's own encoder does not produce.
     */
    it('writes a picture whose header will not read, and sends no probe for it', async () => {
      const assets = backend()
      registerProjectHandlers(deps(holdingPicture(), { assets }))

      await invoke(CHANNELS.assetsSavePicture, {
        replaces: 'asset-1',
        name: 'Gemini 3.1',
        png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64'),
      })

      expect(assets.replaceBytes).toHaveBeenCalledWith(
        'asset-1',
        expect.anything(),
        '.png',
        undefined,
      )
    })

    /**
     * The id travels in a JSON envelope inside the project folder — user territory, like the
     * manifest — and `replaceBytes` builds its path from the ROW's type. An id naming a take
     * would write `audio/<id>.png` and `rm` the `.wav` beside it, destroying a recording from a
     * save on another document entirely.
     */
    it('refuses to overwrite an asset that is not a picture', async () => {
      const assets = backend()
      const holdingTake = { ...catalog, find: vi.fn(async () => asset({ type: 'audio' })) }
      registerProjectHandlers(deps(holdingTake, { assets }))

      await expect(
        invoke(CHANNELS.assetsSavePicture, {
          replaces: 'asset-1',
          name: 'Gemini 3.1',
          png: PNG_BASE64,
        }),
      ).rejects.toThrow()
      expect(assets.replaceBytes).not.toHaveBeenCalled()
    })

    // The bytes are checked before anything is written, so a payload that is not a picture cannot
    // destroy the one it claims to replace.
    it('refuses to overwrite with bytes that are not a picture', async () => {
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets }))

      await expect(
        invoke(CHANNELS.assetsSavePicture, {
          replaces: 'asset-1',
          name: 'Gemini 3.1',
          png: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).toString('base64'),
        }),
      ).rejects.toThrow()
      expect(assets.replaceBytes).not.toHaveBeenCalled()
    })

    it('files it beside its source', async () => {
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets }))

      await invoke(CHANNELS.assetsSavePicture, {
        name: 'Gemini 3.1 copie',
        derivedFrom: 'asset-1',
        png: PNG_BASE64,
      })

      expect(assets.importFromBytes).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'image',
          extension: '.png',
          derivedFrom: 'asset-1',
          probe: expect.objectContaining({ width: 1024, height: 768 }),
        }),
        PNG,
      )
    })

    /**
     * A texture channel edited as a picture is still a channel. Read from the catalogue rather
     * than sent by the renderer, for the reason `saveTexture` gives: the kind is what the folder
     * and the extension follow, and a channel filed as a plain picture leaves its shelf.
     */
    it('gives a derived picture the kind and the channel of its source', async () => {
      const assets = backend()
      const sourced = {
        ...catalog,
        find: vi.fn(async () => asset({ id: 'asset-1', type: 'texture', map: 'normal' })),
      }
      registerProjectHandlers(deps(sourced, { assets }))

      await invoke(CHANNELS.assetsSavePicture, {
        name: 'Brique — Normale copie',
        derivedFrom: 'asset-1',
        png: PNG_BASE64,
      })

      expect(assets.importFromBytes).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'texture', map: 'normal' }),
        expect.anything(),
      )
    })

    it('never hands back where the file sits', async () => {
      const assets = backend()
      assets.replaceBytes = vi.fn(async () =>
        asset({ id: 'asset-1', type: 'image', sourcePath: '/Users/someone/secret.png' }),
      )
      registerProjectHandlers(deps(holdingPicture(), { assets }))

      const saved = await invoke(CHANNELS.assetsSavePicture, {
        replaces: 'asset-1',
        name: 'Gemini 3.1',
        png: PNG_BASE64,
      })

      expect(saved).toEqual(expect.not.objectContaining({ sourcePath: expect.anything() }))
    })

    /**
     * Base64 says nothing about what it encodes, so the check is on the decoded bytes — the only
     * place it can be. Without it, an encoder answering with nothing would overwrite a picture
     * with a file that is not one, and the tile would show an empty frame.
     */
    it('refuses a payload that does not decode to a PNG', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSavePicture, {
          replaces: 'asset-1',
          name: 'Gemini 3.1',
          png: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).toString('base64'),
        }),
      ).rejects.toThrow()
    })

    /** The one mistake worth catching at the front, and the same rule the export applies. */
    it('refuses a data URL, whose prefix would be written into the picture', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSavePicture, {
          replaces: 'asset-1',
          name: 'Gemini 3.1',
          png: `data:image/png;base64,${PNG_BASE64}`,
        }),
      ).rejects.toThrow()
    })

    it('refuses a request with no name to file it under', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSavePicture, { name: '   ', png: PNG_BASE64 }),
      ).rejects.toThrow()
    })
  })

  describe('a layered picture the editor edited', () => {
    // Bytes, not base64: a surface crosses the bridge as what it is — see `OraSurface`.
    const PNG_BYTES = Uint8Array.from(png(1024, 768))

    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-2', type: 'image' })),
      importFromFile: vi.fn(async () => asset({ id: 'asset-2', type: 'image' })),
      replaceBytes: vi.fn(async () => asset({ id: 'asset-1', type: 'image' })),
    })

    const holdingPicture = () => ({
      ...catalog,
      find: vi.fn(async () => asset({ id: 'asset-1', type: 'image' })),
    })

    const layered = (over: Record<string, unknown> = {}) => ({
      name: 'Hero',
      document: {
        stack: {
          width: 1024,
          height: 768,
          nodes: [
            {
              kind: 'layer',
              name: 'Ink',
              src: 'data/p_ink.png',
              x: 0,
              y: 0,
              opacity: 1,
              visible: true,
              composite: 'svg:src-over',
            },
          ],
          studio: '{}',
        },
        surfaces: [
          { path: 'mergedimage.png', png: PNG_BYTES },
          { path: 'data/p_ink.png', png: PNG_BYTES },
        ],
      },
      ...over,
    })

    /**
     * The difference an open container buys, and the reason this channel exists beside
     * `savePicture`: a stack goes back over the file it came from, under the extension that
     * holds it, rather than being flattened into a PNG under the same name.
     */
    it('overwrites the file it came from, as a container', async () => {
      const assets = backend()
      registerProjectHandlers(deps(holdingPicture(), { assets }))

      await invoke(CHANNELS.assetsSaveLayered, layered({ replaces: 'asset-1' }))

      expect(assets.replaceBytes).toHaveBeenCalledWith(
        'asset-1',
        expect.any(Uint8Array),
        '.ora',
        expect.objectContaining({ width: 1024, height: 768 }),
      )
    })

    /** The dimensions come off the FLATTEN the container carries, which is what a tile shows. */
    it('files a copy beside its source, keeping them traceable to each other', async () => {
      const assets = backend()
      registerProjectHandlers(deps(holdingPicture(), { assets }))

      await invoke(CHANNELS.assetsSaveLayered, layered({ derivedFrom: 'asset-1' }))

      expect(assets.importFromBytes).toHaveBeenCalledWith(
        expect.objectContaining({ extension: '.ora', derivedFrom: 'asset-1', name: 'Hero' }),
        expect.any(Uint8Array),
      )
    })

    /** The same guard `savePicture` carries: an id naming a take would write over a recording. */
    it('refuses to overwrite a row that is not a picture', async () => {
      registerProjectHandlers(
        deps(
          { ...catalog, find: vi.fn(async () => asset({ id: 'asset-1', type: 'audio' })) },
          {
            assets: backend(),
          },
        ),
      )

      await expect(
        invoke(CHANNELS.assetsSaveLayered, layered({ replaces: 'asset-1' })),
      ).rejects.toThrow()
    })

    /** A path out of `data/` is a path out of the project folder once the container is unpacked. */
    it('refuses a layer whose file would land outside the container', async () => {
      registerProjectHandlers(deps(holdingPicture(), { assets: backend() }))

      const escaping = layered()
      escaping.document.stack.nodes[0]!.src = '../../etc/passwd.png'

      await expect(invoke(CHANNELS.assetsSaveLayered, escaping)).rejects.toThrow()
    })

    /** The same rule on the SURFACE, which is what actually becomes a ZIP entry. */
    it('refuses a surface whose entry would land outside the container', async () => {
      registerProjectHandlers(deps(holdingPicture(), { assets: backend() }))

      const escaping = layered()
      escaping.document.surfaces[1]!.path = '../../etc/passwd.png'

      await expect(invoke(CHANNELS.assetsSaveLayered, escaping)).rejects.toThrow()
    })
  })
})
