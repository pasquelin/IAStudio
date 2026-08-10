import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FSWatcher } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFolderEditor, createFolderReader, watchProjectFolder } from './folder'

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

    const entries = await createFolderReader(() => root).list('')

    expect(entries.map(entry => `${entry.kind}:${entry.name}`)).toEqual([
      'folder:assets',
      'folder:documents',
      'file:notes.txt',
    ])
  })

  /**
   * The two the studio puts there and can rebuild. Hidden by the platforms' own rule — a
   * leading dot — rather than by a list, so a third one does not have to be remembered.
   */
  it('leaves out what the studio keeps for itself', async () => {
    const root = await project()

    const entries = await createFolderReader(() => root).list('')

    expect(entries.map(entry => entry.name)).not.toContain('.index')
    expect(entries.map(entry => entry.name)).not.toContain('.project.json')
  })

  // The path is the tree's id as well as the path, and it is what the next read is asked for.
  it('names each entry relative to the project root', async () => {
    const root = await project()
    await writeFile(join(root, 'documents', 'a3f1.scene'), '{}')

    const entries = await createFolderReader(() => root).list('documents')

    expect(entries[0]?.path).toBe('documents/a3f1.scene')
  })

  it('reads the folder of whatever project is open at call time', async () => {
    const first = await project()
    const second = await project()
    await writeFile(join(second, 'only-here.txt'), '')
    let open = first

    const reader = createFolderReader(() => open)
    open = second

    expect((await reader.list('')).map(entry => entry.name)).toContain('only-here.txt')
  })
})

describe('following the project folder', () => {
  const watches: { stop: () => void }[] = []
  afterEach(() => {
    for (const watch of watches) watch.stop()
    watches.length = 0
  })

  // Writing one asset makes several events, and an export writes a folder of them. Real timers
  // on purpose: the events come from the operating system, and a fake clock advances past a
  // debounce that was never armed — which is a test that passes on a watcher doing nothing.
  it('announces a burst once', async () => {
    const root = await project()
    const announce = vi.fn()
    watches.push(watchProjectFolder(root, announce))

    await writeFile(join(root, 'one.txt'), '')
    await writeFile(join(root, 'two.txt'), '')
    await vi.waitFor(() => expect(announce).toHaveBeenCalled(), { timeout: 4000 })

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
      return { close: () => undefined, on: () => undefined } as unknown as FSWatcher
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
 * The three gestures that write to someone else's folder. All refuse the studio's own layout,
 * and none erases anything: `trashItem` puts the file where it can be got back.
 */
describe('writing to the project folder', () => {
  it('renames in place, inside the folder it already sits in', async () => {
    const root = await project()
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.rename('notes.txt', 'brief.txt')).toBe(true)

    const names = (await createFolderReader(() => root).list('')).map(entry => entry.name)
    expect(names).toContain('brief.txt')
    expect(names).not.toContain('notes.txt')
  })

  it('renames what is inside a folder without moving it out of it', async () => {
    const root = await project()
    await writeFile(join(root, 'documents', 'a3f1.scene'), '{}')
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.rename('documents/a3f1.scene', 'level.scene')).toBe(true)

    const entries = await createFolderReader(() => root).list('documents')
    expect(entries.map(entry => entry.path)).toEqual(['documents/level.scene'])
  })

  // `rename` overwrites without a word on POSIX, and the file it would overwrite is the user's.
  it('refuses a name already taken rather than writing over it', async () => {
    const root = await project()
    await writeFile(join(root, 'brief.txt'), 'keep me')
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.rename('notes.txt', 'brief.txt')).toBe(false)

    const names = (await createFolderReader(() => root).list('')).map(entry => entry.name)
    expect(names).toContain('notes.txt')
  })

  it('says yes and does nothing when the name has not changed', async () => {
    const root = await project()
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.rename('notes.txt', 'notes.txt')).toBe(true)
  })

  it('refuses a file that is not there', async () => {
    const root = await project()
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.rename('gone.txt', 'other.txt')).toBe(false)
  })

  // The catalogue stores every asset by a path under `assets/`: moving one orphans rows nobody
  // can find again, and the refusal belongs here rather than in the window that asked.
  it.each(['assets', 'documents', 'assets/img', ''])(
    'refuses to move the studio folder %s',
    async path => {
      const root = await project()
      const toTrash = vi.fn()
      const editor = createFolderEditor(() => root, toTrash)

      expect(await editor.rename(path, 'elsewhere')).toBe(false)
      expect(await editor.trash(path)).toBe(false)
      expect(toTrash).not.toHaveBeenCalled()
    },
  )

  it('hands a file to the system trash rather than deleting it', async () => {
    const root = await project()
    const toTrash = vi.fn(async () => undefined)
    const editor = createFolderEditor(() => root, toTrash)

    expect(await editor.trash('notes.txt')).toBe(true)

    expect(toTrash).toHaveBeenCalledWith(join(root, 'notes.txt'))
  })

  it('answers no when the system would not take it', async () => {
    const root = await project()
    const editor = createFolderEditor(
      () => root,
      vi.fn(async () => Promise.reject(new Error('no'))),
    )

    expect(await editor.trash('notes.txt')).toBe(false)
  })
})

/**
 * The drag in the tree. Kept apart from `rename` on purpose: a menu row reading "Rename" must
 * not be able to displace a file, so the two gestures cannot be one call.
 */
describe('moving inside the project folder', () => {
  async function withFolder(): Promise<string> {
    const root = await project()
    await mkdir(join(root, 'notes'))
    return root
  }

  it('carries the file into the folder it was dropped on, under the same name', async () => {
    const root = await withFolder()
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.move('notes.txt', 'notes')).toBe(true)

    const reader = createFolderReader(() => root)
    expect((await reader.list('notes')).map(entry => entry.path)).toEqual(['notes/notes.txt'])
    expect((await reader.list('')).map(entry => entry.name)).not.toContain('notes.txt')
  })

  it('carries it back out of a folder as readily as in', async () => {
    const root = await withFolder()
    await mkdir(join(root, 'refs'))
    await writeFile(join(root, 'notes', 'brief.txt'), 'hello')
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.move('notes/brief.txt', 'refs')).toBe(true)

    expect((await createFolderReader(() => root).list('refs')).map(entry => entry.path)).toEqual([
      'refs/brief.txt',
    ])
  })

  it('carries a folder and everything under it', async () => {
    const root = await withFolder()
    await mkdir(join(root, 'refs'))
    await writeFile(join(root, 'notes', 'brief.txt'), 'hello')
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.move('notes', 'refs')).toBe(true)

    const entries = await createFolderReader(() => root).list('refs/notes')
    expect(entries.map(entry => entry.path)).toEqual(['refs/notes/brief.txt'])
  })

  // Same reason as the rename: `rename` overwrites without a word on POSIX, and what it would
  // overwrite is the user's own file.
  it('refuses a name already taken in the folder it lands in', async () => {
    const root = await withFolder()
    await writeFile(join(root, 'notes', 'notes.txt'), 'keep me')
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.move('notes.txt', 'notes')).toBe(false)

    const kept = await createFolderReader(() => root).list('notes')
    expect(kept.map(entry => entry.path)).toEqual(['notes/notes.txt'])
  })

  it('says yes and writes nothing when it is dropped on the folder it is already in', async () => {
    const root = await withFolder()
    await writeFile(join(root, 'notes', 'brief.txt'), 'hello')
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.move('notes/brief.txt', 'notes')).toBe(true)

    expect((await createFolderReader(() => root).list('notes')).map(one => one.path)).toEqual([
      'notes/brief.txt',
    ])
  })

  it.each(['assets', 'documents', 'assets/img', ''])(
    'refuses the studio folder %s as what moves',
    async path => {
      const root = await withFolder()

      expect(await createFolderEditor(() => root, vi.fn()).move(path, 'notes')).toBe(false)
    },
  )

  // The half a drag adds over the menu: the menu can only name what moves, a drag names both.
  it.each(['assets', 'documents', 'assets/img', ''])(
    'refuses the studio folder %s as what receives',
    async folder => {
      const root = await withFolder()

      expect(await createFolderEditor(() => root, vi.fn()).move('notes.txt', folder)).toBe(false)
    },
  )

  it('refuses a folder dropped inside itself, which would take its destination with it', async () => {
    const root = await withFolder()
    await mkdir(join(root, 'notes', 'drafts'))
    const editor = createFolderEditor(() => root, vi.fn())

    expect(await editor.move('notes', 'notes/drafts')).toBe(false)
    expect(await editor.move('notes', 'notes')).toBe(false)
  })

  // No check of its own guards this: renaming into a file fails with ENOTDIR, and the catch is
  // already the answer. Which is exactly why it is tested — the guard that is missing on
  // purpose is the one a later reader adds back.
  it('refuses a destination that is a file rather than a folder', async () => {
    const root = await withFolder()
    await writeFile(join(root, 'brief.txt'), 'hello')

    expect(await createFolderEditor(() => root, vi.fn()).move('notes.txt', 'brief.txt')).toBe(false)
  })

  it('refuses a destination folder that is not there', async () => {
    const root = await withFolder()

    expect(await createFolderEditor(() => root, vi.fn()).move('notes.txt', 'gone')).toBe(false)
  })

  it('refuses a file that is not there', async () => {
    const root = await withFolder()

    expect(await createFolderEditor(() => root, vi.fn()).move('gone.txt', 'notes')).toBe(false)
  })
})
