import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FSWatcher } from 'node:fs'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import {
  createFolderReader,
  createFolderWriter,
  watchProjectFolder,
  type WatchOpener,
} from './folder'

/**
 * The language the listing is sorted for, named rather than inherited.
 *
 * It used to be `windowLanguage()`, a module global no test could set: every ordering case below
 * rode on `DEFAULT_LANGUAGE` without saying so, and another suite's `beforeEach` could move it.
 */
const inFrench = (): string => 'fr'

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-folder-'))
  await mkdir(join(root, 'assets'))
  await mkdir(join(root, 'documents'))
  await mkdir(join(root, '.index'))
  await writeFile(join(root, '.project.json'), '{}')
  await writeFile(join(root, 'notes.txt'), 'hello')
  return root
}

describe('reading the project folder', () => {
  it('lists one level, folders first and then by name', async () => {
    const root = await project()

    const entries = await createFolderReader(() => root, inFrench).list('')

    expect(entries.map(entry => `${entry.kind}:${entry.name}`)).toEqual([
      'folder:assets',
      'folder:documents',
      'file:notes.txt',
    ])
  })

  /**
   * The case injecting the language exists to make writable, and it could not be written while the
   * reader took it off a module global.
   *
   * `Ä` files with `A` for both of the studio's languages and after `Z` for a Swedish reader, so a
   * listing sorted in whatever locale the machine was installed in is a listing in an order nobody
   * asked for — which is what a bare `localeCompare` did here.
   */
  it('sorts for the language it is handed, not the one the machine runs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scenario-folder-'))
    await writeFile(join(root, 'Ärger.txt'), '')
    await writeFile(join(root, 'Zoo.txt'), '')

    const namesIn = async (language: string): Promise<string[]> =>
      (
        await createFolderReader(
          () => root,
          () => language,
        ).list('')
      ).map(entry => entry.name)

    expect(await namesIn('fr')).toEqual(['Ärger.txt', 'Zoo.txt'])
    expect(await namesIn('sv')).toEqual(['Zoo.txt', 'Ärger.txt'])
  })

  /**
   * The two the studio puts there and can rebuild. Hidden by the platforms' own rule — a
   * leading dot — rather than by a list, so a third one does not have to be remembered.
   */
  it('leaves out what the studio keeps for itself', async () => {
    const root = await project()

    const entries = await createFolderReader(() => root, inFrench).list('')

    expect(entries.map(entry => entry.name)).not.toContain('.index')
    expect(entries.map(entry => entry.name)).not.toContain('.project.json')
  })

  it('shows them to a reader who asked for them', async () => {
    const root = await project()

    const entries = await createFolderReader(() => root, inFrench).list('', true)

    expect(entries.map(entry => entry.name)).toContain('.index')
    expect(entries.map(entry => entry.name)).toContain('.project.json')
  })

  // The path is the tree's id as well as the path, and it is what the next read is asked for.
  it('names each entry relative to the project root', async () => {
    const root = await project()
    await writeFile(join(root, 'documents', 'a3f1.scene'), '{}')

    const entries = await createFolderReader(() => root, inFrench).list('documents')

    expect(entries[0]?.path).toBe('documents/a3f1.scene')
  })

  it('reads the folder of whatever project is open at call time', async () => {
    const first = await project()
    const second = await project()
    await writeFile(join(second, 'only-here.txt'), '')
    let open = first

    const reader = createFolderReader(() => open, inFrench)
    open = second

    expect((await reader.list('')).map(entry => entry.name)).toContain('only-here.txt')
  })

  /**
   * `Été` is six characters on screen and two different strings underneath — composed, as a
   * keyboard sends it, or decomposed, as a volume that stores it that way hands it back. Left as
   * they come, the catalogue holds one form and the folder answers the other, and every
   * comparison of the two says no: the row the explorer joins to this file, the path a rescan
   * recognises, the asset an inspector finds.
   *
   * Composed here and in `safeFileName`, which are the two places the studio meets the question:
   * where the disk speaks, and where a name is made.
   */
  it('answers a decomposed name in the form a name made here takes', async () => {
    const root = await project()
    const named = 'Été.png'
    const decomposed = named.normalize('NFD')
    await writeFile(join(root, decomposed), 'bytes', 'utf8')

    const found = await createFolderReader(() => root, inFrench).list('')
    const names = found.map(entry => entry.name)

    expect(names).toContain('Été'.normalize('NFC') + '.png')
    expect(names).not.toContain(decomposed)
    expect(found.find(entry => entry.name.startsWith('É'))?.path).toBe('Été.png'.normalize('NFC'))
  })
})

describe('searching the project folder', () => {
  const namesFound = async (root: string, term: string, hidden?: boolean): Promise<string[]> =>
    (await createFolderReader(() => root, inFrench).search(term, hidden)).map(entry => entry.path)

  /**
   * The whole reason this channel exists: the tree reads one folder at a time, so a file three
   * folds down is a file it has never seen — and a search that filtered what is loaded would
   * answer nothing for it.
   */
  it('finds a file no reader has unfolded, folders included', async () => {
    const root = await project()
    await mkdir(join(root, 'Repérages', 'Ruelles'), { recursive: true })
    await writeFile(join(root, 'Repérages', 'Ruelles', 'ruelle-bleue.png'), '')

    expect(await namesFound(root, 'ruelle')).toEqual([
      'Repérages/Ruelles',
      'Repérages/Ruelles/ruelle-bleue.png',
    ])
  })

  // The hand that types into a search box is looking, not spelling.
  it('answers a term typed without its accents', async () => {
    const root = await project()
    await writeFile(join(root, 'Forêt.png'), '')

    expect(await namesFound(root, 'foret')).toEqual(['Forêt.png'])
  })

  it('leaves out what the studio keeps for itself, unless it was asked for', async () => {
    const root = await project()
    await writeFile(join(root, '.index', 'catalog.db'), '')

    expect(await namesFound(root, 'catalog')).toEqual([])
    expect(await namesFound(root, 'catalog', true)).toEqual(['.index/catalog.db'])
  })

  /**
   * An image document IS a folder — `<id>.img/` holding its manifest and its parts. What it
   * holds is the studio's own writing, and offering those parts as results would hand the reader
   * files no space can open in place of the document they belong to.
   */
  it('does not walk into a document that happens to be a folder', async () => {
    const root = await project()
    await mkdir(join(root, 'ruelle.img'))
    await writeFile(join(root, 'ruelle.img', 'ruelle-part.png'), '')

    expect(await namesFound(root, 'ruelle')).toEqual(['ruelle.img'])
  })

  it('answers nothing at all for an empty term', async () => {
    const root = await project()

    expect(await namesFound(root, '   ')).toEqual([])
  })
})

describe('walking the project folder for what it holds', () => {
  const walked = async (root: string, hidden?: boolean): Promise<string[]> =>
    (await createFolderReader(() => root, inFrench).walk(hidden)).map(entry => entry.path)

  /**
   * The domain view asks what a file IS, and a folder is not a domain — except one written as a
   * document, which is an item and answers as one.
   */
  it('answers the files at every depth, and no folder of its own', async () => {
    const root = await project()
    await mkdir(join(root, 'Repérages', 'Ruelles'), { recursive: true })
    await writeFile(join(root, 'Repérages', 'Ruelles', 'ruelle.png'), '')
    await mkdir(join(root, 'planche.img'))
    await writeFile(join(root, 'planche.img', 'document.json'), '{}')

    expect((await walked(root)).sort()).toEqual([
      'Repérages/Ruelles/ruelle.png',
      'notes.txt',
      'planche.img',
    ])
  })

  it('leaves out what the studio keeps for itself, unless it was asked for', async () => {
    const root = await project()
    await writeFile(join(root, '.index', 'catalog.db'), '')

    expect(await walked(root)).not.toContain('.index/catalog.db')
    expect(await walked(root, true)).toContain('.index/catalog.db')
  })
})

describe('following the project folder', () => {
  // `as`: a watcher these tests never listen to, and only `close` is ever called on it. Naming
  // the cast once keeps the two fake openers from each carrying their own.
  const deaf = (): FSWatcher =>
    ({ close: () => undefined, on: () => undefined }) as unknown as FSWatcher

  const watches: { stop: () => void }[] = []
  afterEach(() => {
    for (const watch of watches) watch.stop()
    watches.length = 0
  })

  /**
   * What only a real watcher can prove: that the platform's events reach us, and that a real
   * stream of them still collapses into one announcement. The driven test next door picks its
   * own clock, so it can never see two events landing further apart than the debounce.
   *
   * Real timers on purpose — a fake clock advances past a debounce that was never armed, which
   * is a test that passes on a watcher doing nothing.
   *
   * The wait is wall time on a machine that may be building something else: four seconds of it
   * turned `pnpm validate` red about once in twelve. It stays BELOW `TEST_TIMEOUT`
   * (`vitest.config.ts`), or vitest kills the test first and the failure loses the one line that
   * names what went wrong — which is how this defect stayed anonymous for four rounds.
   */
  it('announces what lands in the folder', async () => {
    const root = await project()
    const announce = vi.fn()
    watches.push(watchProjectFolder(root, announce))

    /**
     * The folder was made moments ago and its own creation is still in flight. Drained and
     * forgotten here, because otherwise an announcement `project()` caused would answer for one
     * this case never made: starved of its two writes, the case still passed 8 runs out of 10.
     *
     * 500 ms is measured, not the debounce plus a margin. What bounds it is the LAST leftover
     * arriving, plus the debounce it arms: leftovers land at 3–52 ms, so the cliff sits near
     * 352 ms. Starved, 200 ms still passed 4 times in 6; 350 ms, 500 ms and 1500 ms passed none.
     */
    await new Promise(done => setTimeout(done, 500))
    announce.mockClear()

    await writeFile(join(root, 'one.txt'), '')
    await writeFile(join(root, 'two.txt'), '')
    await vi.waitFor(() => expect(announce).toHaveBeenCalled(), { timeout: 10_000 })

    expect(announce).toHaveBeenCalledTimes(1)
  })

  /**
   * The debounce itself, with no operating system in the loop. Two events inside the window make
   * one announcement, and the second is what clears the first one's timer.
   *
   * Driven rather than provoked, because whether two writes arrive as two events or as one is
   * the platform's decision: when it coalesced them, `clearTimeout` was never reached and two
   * identical runs took different paths through this file.
   */
  it('collapses a burst into one announcement', () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const announce = vi.fn()
    let emit = (): void => undefined
    const driven: WatchOpener = (_path, _options, listener) => {
      emit = listener
      return deaf()
    }
    watches.push(watchProjectFolder('/projects/demo', announce, driven))

    emit()
    emit()
    // Well past the debounce, whatever it is set to: what is asserted is the collapse, not its
    // duration — a test that pinned the delay would fail on every tuning of it.
    vi.advanceTimersByTime(5000)

    expect(announce).toHaveBeenCalledTimes(1)
  })

  /**
   * The path a platform without a recursive watch takes — Linux emits one event per watched
   * folder, and older ones refuse `recursive` outright. It cannot be reached on the machine
   * this is written on, which is exactly why the opener is injected: written and never run is
   * the same as not written.
   */
  it('falls back to a flat watch when the platform refuses a recursive one', () => {
    const opened: { recursive?: boolean }[] = []
    const fake = (_path: string, options: { recursive?: boolean }) => {
      opened.push(options)
      if (options.recursive) throw new Error('not supported')
      return deaf()
    }

    const watch = watchProjectFolder('/projects/demo', vi.fn(), fake)
    watches.push(watch)

    expect(opened).toEqual([{ recursive: true }, {}])
  })

  // A folder that cannot be watched is not a folder that cannot be read: the panel still lists
  // it, and the read on refocus is what keeps it current.
  it('gives up quietly when even a flat watch is refused', async () => {
    const announce = vi.fn()
    const refuse = (): FSWatcher => {
      throw new Error('not supported')
    }

    const watch = watchProjectFolder('/projects/demo', announce, refuse)
    watches.push(watch)

    expect(() => watch.stop()).not.toThrow()
    expect(announce).not.toHaveBeenCalled()
  })

  // A folder that cannot be watched is not a folder that cannot be read: the panel still lists
  // it, it just will not follow it on its own.
  it('says nothing and breaks nothing on a folder that is not there', () => {
    const watch = watchProjectFolder(join(tmpdir(), 'scenario-missing-folder'), vi.fn())

    expect(() => watch.stop()).not.toThrow()
  })

  // Stopped between the event and the announcement, which is the window a project being closed
  // falls into: the folder of the project just left must not announce into the next one.
  it('stops announcing once it is stopped, even with an event already in flight', async () => {
    const root = await project()
    const announce = vi.fn()
    const watch = watchProjectFolder(root, announce)

    await writeFile(join(root, 'one.txt'), '')
    // Long enough for the event to have armed the debounce, short enough to be inside it: what
    // this measures is a stop that lands BETWEEN the two, which is the window a closing project
    // falls into.
    await new Promise(done => setTimeout(done, 60))
    watch.stop()
    await new Promise(done => setTimeout(done, 800))

    expect(announce).not.toHaveBeenCalled()
  })
})

/**
 * The names a folder holds, hidden ones included.
 *
 * Apart from `list` because they answer two different questions: `list` is what a READER sees,
 * and a name under a dot is not shown while still occupying its name. Planning against the shown
 * list would hand a write a name something already answers to.
 */
describe('reading the names a folder holds', () => {
  it('counts what the listing hides, so a plan cannot claim a name that is taken', async () => {
    const root = await project()
    const reader = createFolderReader(() => root, inFrench)

    expect(await reader.names('')).toContain('.project.json')
    expect((await reader.list('')).map(entry => entry.name)).not.toContain('.project.json')
  })

  // How a destination that has gone — or that turned out to be a file — is told from an empty one.
  it('answers nothing at all for a path that is not a folder', async () => {
    const root = await project()
    const reader = createFolderReader(() => root, inFrench)

    expect(await reader.names('notes.txt')).toBeNull()
    expect(await reader.names('gone')).toBeNull()
  })
})

/**
 * The four gestures that write to someone else's folder.
 *
 * **They refuse nothing on their own account**, and that is the change this phase made: what may
 * be written is decided once, in `filePlan.ts`. What is left here is the one refusal a plan
 * cannot make because it is a race and not a rule — a name that appeared between the reading and
 * the write, which `rename` and `cp` would take without a word on POSIX.
 */
describe('writing to the project folder', () => {
  async function withFolder(): Promise<string> {
    const root = await project()
    await mkdir(join(root, 'notes'))
    return root
  }

  it('carries a file to the path it is given, folder and name at once', async () => {
    const root = await withFolder()
    const writer = createFolderWriter(() => root, vi.fn())

    expect(await writer.move('notes.txt', 'notes/brief.txt')).toBe(true)

    const reader = createFolderReader(() => root, inFrench)
    expect((await reader.list('notes')).map(entry => entry.path)).toEqual(['notes/brief.txt'])
    expect((await reader.list('')).map(entry => entry.name)).not.toContain('notes.txt')
  })

  it('carries a folder and everything under it', async () => {
    const root = await withFolder()
    await mkdir(join(root, 'refs'))
    await writeFile(join(root, 'notes', 'brief.txt'), 'hello')
    const writer = createFolderWriter(() => root, vi.fn())

    expect(await writer.move('notes', 'refs/notes')).toBe(true)

    const entries = await createFolderReader(() => root, inFrench).list('refs/notes')
    expect(entries.map(entry => entry.path)).toEqual(['refs/notes/brief.txt'])
  })

  it('copies a folder whole, leaving the original where it is', async () => {
    const root = await withFolder()
    await writeFile(join(root, 'notes', 'brief.txt'), 'hello')
    const writer = createFolderWriter(() => root, vi.fn())

    expect(await writer.copy('notes', 'notes 2')).toBe(true)

    const reader = createFolderReader(() => root, inFrench)
    expect((await reader.list('notes 2')).map(entry => entry.path)).toEqual(['notes 2/brief.txt'])
    expect((await reader.list('notes')).map(entry => entry.path)).toEqual(['notes/brief.txt'])
  })

  it('makes a folder where nothing stands', async () => {
    const root = await project()
    const writer = createFolderWriter(() => root, vi.fn())

    expect(await writer.createFolder('Characters')).toBe(true)

    expect(
      (await createFolderReader(() => root, inFrench).list('')).map(one => one.name),
    ).toContain('Characters')
  })

  // The race a plan cannot see: `rename` and `cp` overwrite without a word on POSIX, and what
  // they would take is the user's own file.
  it.each(['move', 'copy', 'createFolder'])(
    'refuses %s onto a name already there',
    async gesture => {
      const root = await withFolder()
      await writeFile(join(root, 'brief.txt'), 'keep me')
      const writer = createFolderWriter(() => root, vi.fn())

      const written =
        gesture === 'move'
          ? await writer.move('notes.txt', 'brief.txt')
          : gesture === 'copy'
            ? await writer.copy('notes.txt', 'brief.txt')
            : await writer.createFolder('brief.txt')

      expect(written).toBe(false)
      expect(await readFile(join(root, 'brief.txt'), 'utf8')).toBe('keep me')
    },
  )

  it('says yes and does nothing when a move lands where it already is', async () => {
    const root = await project()
    const writer = createFolderWriter(() => root, vi.fn())

    expect(await writer.move('notes.txt', 'notes.txt')).toBe(true)
    expect(await readFile(join(root, 'notes.txt'), 'utf8')).toBe('hello')
  })

  it('answers no rather than throwing when there is nothing to move', async () => {
    const root = await project()
    const writer = createFolderWriter(() => root, vi.fn())

    expect(await writer.move('gone.txt', 'other.txt')).toBe(false)
    expect(await writer.copy('gone.txt', 'other.txt')).toBe(false)
  })

  it('hands a file to the system trash rather than deleting it', async () => {
    const root = await project()
    const toTrash = vi.fn(async () => undefined)
    const writer = createFolderWriter(() => root, toTrash)

    expect(await writer.trash('notes.txt')).toBe(true)

    expect(toTrash).toHaveBeenCalledWith(join(root, 'notes.txt'))
  })

  it('answers no when the system would not take it', async () => {
    const root = await project()
    const writer = createFolderWriter(
      () => root,
      vi.fn(async () => Promise.reject(new Error('no'))),
    )

    expect(await writer.trash('notes.txt')).toBe(false)
  })
})
