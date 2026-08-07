import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_FOLDERS } from '@shared/domain/project'
import { createProjectStore, NoProjectError, type ProjectStore } from './store'
import { memoryCatalog } from './catalog-fixtures'

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

describe('project store', () => {
  let root: string
  let onChange: (project: unknown) => void
  let store: ProjectStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-project-'))
    onChange = vi.fn()
    store = createProjectStore({
      // In memory: the catalogue's own tests cover the SQL, and a project test has no reason
      // to leave a database file behind.
      openCatalog: async () => memoryCatalog(),
      now: () => '2026-08-06T10:00:00.000Z',
      onChange,
    })
  })

  afterEach(async () => {
    store.close()
    await rm(root, { recursive: true, force: true })
  })

  it('creates the whole tree and its manifest', async () => {
    const project = await store.create(root, 'My project')

    expect(project.path).toBe(join(root, 'My project.scenario'))
    for (const folder of PROJECT_FOLDERS) {
      expect(await exists(join(project.path, folder))).toBe(true)
    }

    const manifest: unknown = JSON.parse(await readFile(join(project.path, 'project.json'), 'utf8'))
    expect(manifest).toEqual({
      version: 1,
      name: 'My project',
      createdAt: '2026-08-06T10:00:00.000Z',
      updatedAt: '2026-08-06T10:00:00.000Z',
    })
  })

  it('announces the project it just opened', async () => {
    const project = await store.create(root, 'My project')
    expect(onChange).toHaveBeenCalledWith(project)
    expect(store.current()).toEqual(project)
  })

  it('reopens a project it created', async () => {
    const created = await store.create(root, 'My project')
    store.close()

    expect(store.current()).toBeNull()
    expect(await store.open(created.path)).toEqual(created)
  })

  it('rebuilds a folder deleted between two sessions rather than refusing to open', async () => {
    const created = await store.create(root, 'My project')
    await rm(join(created.path, 'assets/vid'), { recursive: true })
    store.close()

    await store.open(created.path)
    expect(await exists(join(created.path, 'assets/vid'))).toBe(true)
  })

  it('refuses a manifest it cannot make sense of', async () => {
    const created = await store.create(root, 'My project')
    await writeFile(join(created.path, 'project.json'), '{"name":42}', 'utf8')
    store.close()

    await expect(store.open(created.path)).rejects.toThrow()
  })

  it('keeps the open project when the next one fails to open', async () => {
    let failNext = false
    const fragile = createProjectStore({
      openCatalog: async () => {
        if (failNext) throw new Error('database is locked')
        return memoryCatalog()
      },
      now: () => '2026-08-06T10:00:00.000Z',
      onChange,
    })

    const first = await fragile.create(root, 'First')
    const second = await fragile.create(root, 'Second')
    await fragile.open(first.path)

    failNext = true

    // The catalogue that failed must not cost the user the one that was working.
    await expect(fragile.open(second.path)).rejects.toThrow('database is locked')
    expect(fragile.current()).toEqual(first)
    expect(() => fragile.catalog()).not.toThrow()

    fragile.close()
  })

  it('refuses to hand out a catalogue or a path with no project open', () => {
    expect(() => store.catalog()).toThrow(NoProjectError)
    expect(() => store.path()).toThrow(NoProjectError)
  })

  it('indexes into the project that is open, and only that one', async () => {
    await store.create(root, 'First')
    await store.catalog().add({
      id: 'asset_1',
      name: 'Boulder',
      type: 'image',
      location: 'local',
      tags: [],
      createdAt: '2026-08-06T10:00:00.000Z',
    })

    await store.create(root, 'Second')
    await expect(store.catalog().search({})).resolves.toEqual([])
  })
})
