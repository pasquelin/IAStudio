import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANIFEST_FILE, MANIFEST_VERSION, PROJECT_FOLDERS } from '@shared/domain/project'
import { isRecord } from '@shared/guards'
import { createProjectStore, NoProjectError, ProjectOpenError, type ProjectStore } from './store'
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
  let clock: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-project-'))
    onChange = vi.fn()
    clock = '2026-08-06T10:00:00.000Z'
    store = createProjectStore({
      // In memory: the catalogue's own tests cover the SQL, and a project test has no reason
      // to leave a database file behind.
      openCatalog: async () => memoryCatalog(),
      now: () => clock,
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

  // The reason has to travel with the rejection, or what reaches the user is an `ENOENT` about
  // a path they never typed — they picked a folder from a dialog.
  describe('a folder that will not open', () => {
    const reasonOf = async (path: string): Promise<string> => {
      try {
        await store.open(path)
      } catch (error) {
        if (error instanceof ProjectOpenError) return error.reason
        throw error
      }
      throw new Error('the folder opened')
    }

    it('tells a folder that is not a project from one that is broken', async () => {
      const plain = join(root, 'Just a folder')
      await mkdir(plain, { recursive: true })

      expect(await reasonOf(plain)).toBe('not-a-project')
    })

    it('calls a manifest that is not JSON unreadable', async () => {
      const path = join(root, 'Truncated')
      await mkdir(path, { recursive: true })
      await writeFile(join(path, MANIFEST_FILE), '{ "version": 1, "name"', 'utf8')

      expect(await reasonOf(path)).toBe('unreadable')
    })

    // `1.5` is a broken manifest, not a newer one: telling its owner to update the studio would
    // send them after a release that will never fix it.
    it('calls a version that is not a whole number unreadable', async () => {
      const path = join(root, 'Fractional')
      await mkdir(path, { recursive: true })
      await writeFile(
        join(path, MANIFEST_FILE),
        JSON.stringify({
          version: 1.5,
          name: 'Fractional',
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        }),
        'utf8',
      )

      expect(await reasonOf(path)).toBe('unreadable')
    })

    it('calls a manifest missing a field unreadable', async () => {
      const path = join(root, 'Fieldless')
      await mkdir(path, { recursive: true })
      await writeFile(join(path, MANIFEST_FILE), JSON.stringify({ version: 1 }), 'utf8')

      expect(await reasonOf(path)).toBe('unreadable')
    })

    /**
     * The one that loses work rather than merely annoying: opened, it would be written back with
     * this build's model and silently flattened. `documentEnvelope` has capped its version since
     * the beginning; the manifest only floored it, and a project is the whole folder.
     */
    it('refuses a project written by a later build rather than flattening it', async () => {
      const path = join(root, 'From the future')
      await mkdir(path, { recursive: true })
      await writeFile(
        join(path, MANIFEST_FILE),
        JSON.stringify({
          version: MANIFEST_VERSION + 1,
          name: 'From the future',
          createdAt: '2027-01-01T00:00:00.000Z',
          updatedAt: '2027-01-01T00:00:00.000Z',
        }),
        'utf8',
      )

      expect(await reasonOf(path)).toBe('too-new')
      // The manifest itself is untouched: a refusal must not rewrite what a later build owns.
      expect(JSON.parse(await readFile(join(path, MANIFEST_FILE), 'utf8'))).toMatchObject({
        version: MANIFEST_VERSION + 1,
      })
    })
  })

  // `updatedAt` used to be written once, at creation, and to equal `createdAt` for the life of
  // the project. A field that says "last worked on" and never moves is worse than no field.
  describe('stamping the manifest', () => {
    const stampedIn = async (project: { path: string }): Promise<string> => {
      const manifest: unknown = JSON.parse(
        await readFile(join(project.path, MANIFEST_FILE), 'utf8'),
      )
      return isRecord(manifest) && typeof manifest.updatedAt === 'string' ? manifest.updatedAt : ''
    }

    it('writes the moment of the last save, and leaves the creation alone', async () => {
      const project = await store.create(root, 'My project')
      clock = '2026-08-06T11:30:00.000Z'

      store.touch()
      await store.settled()

      expect(await stampedIn(project)).toBe('2026-08-06T11:30:00.000Z')
      expect(store.current()?.manifest.createdAt).toBe('2026-08-06T10:00:00.000Z')
      expect(store.current()?.manifest.updatedAt).toBe('2026-08-06T11:30:00.000Z')
    })

    // Autosave fires far faster than the clock moves: a write per save of the same millisecond
    // would spend the disk on a field nobody would see change.
    it('writes nothing when the stamp would not change', async () => {
      const project = await store.create(root, 'My project')
      const before = await stat(join(project.path, MANIFEST_FILE))

      store.touch()
      await store.settled()

      expect((await stat(join(project.path, MANIFEST_FILE))).mtimeMs).toBe(before.mtimeMs)
    })

    it('does nothing at all when no project is open', async () => {
      expect(() => store.touch()).not.toThrow()
      await store.settled()
    })
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
