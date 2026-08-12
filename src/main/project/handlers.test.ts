import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { memoryCatalog } from './catalog-fixtures'
import { registerProjectHandlers, type ProjectHandlerDeps } from './handlers'
import { ProjectOpenError, type ProjectOpenFailure } from './store'
import type { AsyncCatalog } from './catalog-client'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const PROJECT = '/Users/someone/Films/Reel.scenario'

const MANIFEST = { version: 1, name: 'Reel', createdAt: '', updatedAt: '' }

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'A001',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

function deps(catalog: AsyncCatalog, overrides: Partial<ProjectHandlerDeps> = {}) {
  return {
    project: {
      create: vi.fn(),
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
      write: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    reveal: vi.fn(),
    // Present by default: a folder that has gone is the case a test says so itself.
    exists: vi.fn(() => true),
    folder: {
      list: vi.fn(async () => []),
      rename: vi.fn(async () => true),
      move: vi.fn(async () => true),
      trash: vi.fn(async () => true),
    },
    // An empty string is what `shell.openPath` answers when the system took the file.
    openInSystem: vi.fn(async () => ''),
    // Cancel: the safe answer, so a test that does not care about the dialog cannot destroy
    // anything by not caring.
    askUser: vi.fn(async () => 2),
    ...overrides,
  }
}

describe('project handlers', () => {
  let catalog: AsyncCatalog

  beforeEach(() => {
    resetHandlers()
    vi.clearAllMocks()
    catalog = memoryCatalog()
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

      await expect(invoke(CHANNELS.projectCreate, PROJECT, 'Reel')).rejects.toThrow()

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

      await expect(invoke(CHANNELS.projectCreate, '', 'Reel')).rejects.toThrow()

      expect(injected.project.create).not.toHaveBeenCalled()
      expect(injected.record).not.toHaveBeenCalled()
    })

    it('says nothing when the folder takes one', async () => {
      const injected = deps(catalog)
      injected.project.create = vi.fn(() => Promise.resolve({ path: PROJECT, manifest: MANIFEST }))
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectCreate, PROJECT, 'Reel')).resolves.toBeDefined()

      expect(injected.record).not.toHaveBeenCalled()
    })
  })

  describe('walking the project folder', () => {
    it('lists the folder that was asked for', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await invoke(CHANNELS.projectListFolder, 'assets/img')

      expect(injected.folder.list).toHaveBeenCalledWith('assets/img')
    })

    // The one channel where a window names a path of its own, and `join` walks out of the
    // project on every platform. The listing must never be reached at all.
    it('refuses a path that would climb out of the project', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectListFolder, '../..')).rejects.toThrow()

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

    it('renames, and says nothing in the journal when it worked', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRenameFile, 'notes.txt', 'brief.txt')).resolves.toBe(true)

      expect(injected.folder.rename).toHaveBeenCalledWith('notes.txt', 'brief.txt')
      expect(injected.record).not.toHaveBeenCalled()
    })

    // A row of a context menu that does nothing and explains nothing is the worst outcome of
    // the three.
    it('says so in the journal when a rename is refused', async () => {
      const injected = deps(catalog)
      injected.folder.rename = vi.fn(async () => false)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRenameFile, 'notes.txt', 'brief.txt')).resolves.toBe(
        false,
      )

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.fileNotRenamed',
      })
    })

    // A name with a separator in it would move the file rather than rename it, which is not what
    // the row says it does.
    it.each(['../escape', 'sub/one.txt', ''])('refuses %s as a new name', async name => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectRenameFile, 'notes.txt', name)).rejects.toThrow()

      expect(injected.folder.rename).not.toHaveBeenCalled()
    })

    it('moves, and says nothing in the journal when it happened', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectMoveFile, 'notes.txt', 'refs')).resolves.toBe(true)

      expect(injected.folder.move).toHaveBeenCalledWith('notes.txt', 'refs')
      expect(injected.record).not.toHaveBeenCalled()
    })

    it('says so in the journal when a move is refused', async () => {
      const injected = deps(catalog)
      injected.folder.move = vi.fn(async () => false)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectMoveFile, 'notes.txt', 'assets')).resolves.toBe(false)

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.fileNotMoved',
      })
    })

    // The destination is the second path this channel takes from a window, and it escapes the
    // project exactly as easily as the first.
    it.each(['../escape', '/etc', 'sub\\..\\out'])('refuses %s as a destination', async folder => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectMoveFile, 'notes.txt', folder)).rejects.toThrow()

      expect(injected.folder.move).not.toHaveBeenCalled()
    })

    it('trashes, and says nothing in the journal when the system took it', async () => {
      const injected = deps(catalog)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectTrashFile, 'notes.txt')).resolves.toBe(true)

      expect(injected.folder.trash).toHaveBeenCalledWith('notes.txt')
      expect(injected.record).not.toHaveBeenCalled()
    })

    it('says so in the journal when the system would not take it', async () => {
      const injected = deps(catalog)
      injected.folder.trash = vi.fn(async () => false)
      registerProjectHandlers(injected)

      await expect(invoke(CHANNELS.projectTrashFile, 'notes.txt')).resolves.toBe(false)

      expect(injected.record).toHaveBeenCalledWith({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.fileNotTrashed',
      })
    })

    it.each([CHANNELS.projectRevealFile, CHANNELS.projectTrashFile])(
      'refuses a path that would climb out of the project on %s',
      async channel => {
        const injected = deps(catalog)
        registerProjectHandlers(injected)

        await expect(invoke(channel, '../../etc/passwd')).rejects.toThrow()

        expect(injected.reveal).not.toHaveBeenCalled()
        expect(injected.folder.trash).not.toHaveBeenCalled()
      },
    )
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

  it('refuses an identifier that is not one, rather than passing junk to the catalogue', async () => {
    registerProjectHandlers(deps(catalog))
    await expect(invoke(CHANNELS.assetsReveal, '')).rejects.toThrow()
  })

  describe('a channel the renderer computed', () => {
    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-new', type: 'texture' })),
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
    /** The eight bytes of a PNG signature, as base64 — what every real payload opens with. */
    const PNG_BASE64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')

    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-new', type: 'image' })),
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

      expect(assets.replaceBytes).toHaveBeenCalledWith(
        'asset-1',
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        '.png',
      )
      expect(assets.importFromBytes).not.toHaveBeenCalled()
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
        expect.objectContaining({ type: 'image', extension: '.png', derivedFrom: 'asset-1' }),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
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
})
