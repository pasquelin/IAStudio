import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANIFEST_FILE, PROJECT_FOLDERS } from '@shared/domain/project'
import { createProjectStore, NoProjectError, type ProjectStore } from './store'
import { memoryCatalog } from './catalog-fixtures'

type ExecDone = (error: Error | null, stdout: string, stderr: string) => void

/** Hoisted: `store.ts` promisifies `execFile` as it loads, before any `beforeEach` could run. */
const execFileMock = vi.hoisted(() =>
  vi.fn((_command: string, _args: string[], done: ExecDone) => {
    done(null, '', '')
  }),
)

vi.mock('node:child_process', () => ({ execFile: execFileMock }))

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
    execFileMock.mockClear()
  })

  it('creates the whole tree and its manifest', async () => {
    const project = await store.create(root, 'My project')

    // The folder is named, not suffixed: an extension nothing is registered against decorates
    // a folder the system opens as a folder anyway.
    expect(project.path).toBe(join(root, 'My project'))
    for (const folder of PROJECT_FOLDERS) {
      expect(await exists(join(project.path, folder))).toBe(true)
    }

    const manifest: unknown = JSON.parse(
      await readFile(join(project.path, '.project.json'), 'utf8'),
    )
    expect(manifest).toEqual({
      version: 1,
      name: 'My project',
      createdAt: '2026-08-06T10:00:00.000Z',
      updatedAt: '2026-08-06T10:00:00.000Z',
    })
  })

  // The rule the entry states: what the folder holds for the user stays in the open, what the
  // machine keeps goes under a dot. `layouts/` was neither — nothing has ever written to it.
  it('leaves no folder behind that nothing writes to', () => {
    expect(PROJECT_FOLDERS).not.toContain('layouts')
  })

  /**
   * Projects made before the rename carry `project.json`, and a studio that only looked for the
   * dotted name would stop opening them. Read either, write the new one — the old file is left
   * where it is rather than deleted: a folder the user may be syncing is not ours to tidy.
   */
  it('opens a project whose manifest still carries the old name', async () => {
    const path = join(root, 'Older project')
    await mkdir(join(path, '.index'), { recursive: true })
    await writeFile(
      join(path, 'project.json'),
      JSON.stringify({
        version: 1,
        name: 'Older project',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }),
      'utf8',
    )

    const project = await store.open(path)

    expect(project.manifest.name).toBe('Older project')

    // Migrated as it is read, so the parc converges on its own rather than on the next release.
    // The content is checked, not just the presence: a migration writing the wrong bytes would
    // otherwise ship unseen.
    expect(JSON.parse(await readFile(join(path, MANIFEST_FILE), 'utf8'))).toEqual(project.manifest)
    expect(await exists(join(path, 'project.json'))).toBe(true)
  })

  /**
   * A manifest that exists but cannot be read is NOT a project made before the rename. Taking it
   * for one would read the stale copy beside it and write that over the real thing — the user's
   * own manifest, destroyed without a word. Only an absent file may fall back.
   */
  it('refuses to overwrite a manifest it merely failed to read', async () => {
    const created = await store.create(root, 'My project')
    const hidden = join(created.path, MANIFEST_FILE)
    const before = await readFile(hidden, 'utf8')

    await writeFile(
      join(created.path, 'project.json'),
      JSON.stringify({ ...created.manifest, name: 'Stale name' }),
      'utf8',
    )
    // Writable but unreadable, which is what a restore tool or a syncing service can leave.
    await chmod(hidden, 0o200)
    store.close()

    await expect(store.open(created.path)).rejects.toThrow()

    await chmod(hidden, 0o600)
    expect(await readFile(hidden, 'utf8')).toBe(before)
  })

  /**
   * The Windows half, which no run on this machine would otherwise reach: a leading dot means
   * nothing to the Explorer, so the attribute has to be set through `attrib`. Both the folder
   * and the manifest are hidden, and a failure must not cost the user the project.
   */
  describe('on Windows', () => {
    const realPlatform = process.platform
    const asWindows = (): void => {
      Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    }

    afterEach(() => {
      Object.defineProperty(process, 'platform', { configurable: true, value: realPlatform })
      vi.unstubAllGlobals()
    })

    it('hides what the machine keeps, through the attribute the Explorer reads', async () => {
      asWindows()
      await store.create(root, 'My project')

      const hidden = execFileMock.mock.calls.flatMap(([, args]) => args.slice(1))
      expect(hidden.some(path => path.endsWith('.index'))).toBe(true)
      expect(hidden.some(path => path.endsWith(MANIFEST_FILE))).toBe(true)
    })

    it('opens the project even when the attribute cannot be set', async () => {
      asWindows()
      execFileMock.mockImplementation((_command, _args, done) => {
        done(new Error('attrib is not on the PATH'), '', '')
      })

      await expect(store.create(root, 'My project')).resolves.toBeTruthy()
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
    await writeFile(join(created.path, '.project.json'), '{"name":42}', 'utf8')
    store.close()

    await expect(store.open(created.path)).rejects.toThrow()
  })

  // A folder carrying both is a project opened once since the rename: the old file is left where
  // it is, so it must not be the one that wins.
  it('prefers the hidden manifest over the one left beside it', async () => {
    const created = await store.create(root, 'My project')
    await writeFile(
      join(created.path, 'project.json'),
      JSON.stringify({ ...created.manifest, name: 'Stale name' }),
      'utf8',
    )
    store.close()

    expect((await store.open(created.path)).manifest.name).toBe('My project')
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
