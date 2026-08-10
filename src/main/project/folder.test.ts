import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFolderReader, watchProjectFolder } from './folder'

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
