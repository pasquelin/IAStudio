import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LEGACY_MANIFEST_FILE,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  MACHINE_FOLDERS,
  STARTER_FOLDERS,
} from '@shared/domain/project'
import { ROLE_MARKER } from '@shared/domain/folderRole'
import { isRecord } from '@shared/guards'
import {
  createProjectStore,
  isCatalogueGone,
  NoProjectError,
  orWhenGone,
  ProjectOpenError,
  type ProjectStore,
} from './store'
import { CATALOGUE_CLOSED } from './catalogClient'
import { memoryCatalog } from './catalog-fixtures'

type ExecDone = (error: Error | null, stdout: string, stderr: string) => void

/** Hoisted: `hideFromExplorer.ts` promisifies `execFile` as it loads, before a `beforeEach` runs. */
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
    root = await mkdtemp(join(tmpdir(), 'ia-studio-project-'))
    onChange = vi.fn()
    clock = '2026-08-06T10:00:00.000Z'
    store = createProjectStore({
      // In memory: the catalogue's own tests cover the SQL, and a project test has no reason
      // to leave a database file behind.
      openCatalog: async () => memoryCatalog(),
      now: () => clock,
      onChange,
      onRoles: () => {},
    })
  })

  afterEach(async () => {
    await store.close()
    await rm(root, { recursive: true, force: true })
    execFileMock.mockClear()
  })

  it('creates the whole tree and its manifest', async () => {
    const project = await store.create(root, 'My project')

    // The folder handed in IS the project. Nothing is made from the name — a name that fabricated
    // a subfolder put a project inside the folder the user had just made for it.
    expect(project.path).toBe(root)
    for (const folder of [...MACHINE_FOLDERS, ...STARTER_FOLDERS]) {
      expect(await exists(join(project.path, folder))).toBe(true)
    }

    // The old layout is gone: a document lands in `documents/` when nothing says otherwise and
    // the folder appears with the first save, exactly as an import recreates `Images/`.
    expect(await exists(join(project.path, 'assets'))).toBe(false)
    expect(await exists(join(project.path, 'documents'))).toBe(false)

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
  it('says what each folder it laid down is for, so a rename cannot lose one', async () => {
    const project = await store.create(root, 'My project')

    expect(await readFile(join(project.path, 'Modelling/Models', ROLE_MARKER), 'utf8')).toBe(
      'models\n',
    )
  })

  it('leaves no folder behind that nothing writes to', () => {
    expect([...MACHINE_FOLDERS, ...STARTER_FOLDERS]).not.toContain('layouts')
  })

  /**
   * What makes the starter folders ORDINARY, and the whole reason they are laid down once rather
   * than ensured: a user who threw `Images/` away meant to, and a folder that came back at the
   * next open would be the old layout wearing a new name.
   *
   * The machine's own are the other way round — rebuildable, so a missing cache folder must not
   * be what stops a project from opening.
   */
  it('puts back the caches on open, and never the folders the user was given', async () => {
    const project = await store.create(root, 'My project')

    await rm(join(project.path, 'Images'), { recursive: true, force: true })
    await rm(join(project.path, '.index/peaks'), { recursive: true, force: true })
    await store.close()

    await store.open(project.path)

    expect(await exists(join(project.path, 'Images'))).toBe(false)
    expect(await exists(join(project.path, '.index/peaks'))).toBe(true)
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
   * The migration copies what was understood, never what was merely read. Promoting a truncated
   * legacy manifest would make the dotted copy win on every later open, and the healthy file
   * beside it would never be read again — a project broken for good, on disk, by opening it.
   */
  it('does not promote a legacy manifest it could not parse', async () => {
    const path = join(root, 'Truncated legacy')
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'project.json'), '{ "version": 1, "name"', 'utf8')

    await expect(store.open(path)).rejects.toMatchObject({ reason: 'unreadable' })

    expect(await exists(join(path, MANIFEST_FILE))).toBe(false)
  })

  // Valid JSON the schema still refuses. The bytes are readable, which is exactly what makes this
  // the case a parse-only guard would wave through.
  it('does not promote a legacy manifest the schema refuses', async () => {
    const path = join(root, 'Nameless legacy')
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'project.json'), JSON.stringify({ version: 1 }), 'utf8')

    await expect(store.open(path)).rejects.toMatchObject({ reason: 'unreadable' })

    expect(await exists(join(path, MANIFEST_FILE))).toBe(false)
  })

  // A manifest from a newer studio is not broken, but this build did not understand it either.
  // Leaving it under its old name costs nothing: the build that can read it will migrate it.
  it('does not promote a legacy manifest written by a newer studio', async () => {
    const path = join(root, 'Newer legacy')
    await mkdir(path, { recursive: true })
    await writeFile(
      join(path, 'project.json'),
      JSON.stringify({
        version: MANIFEST_VERSION + 1,
        name: 'Newer legacy',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      }),
      'utf8',
    )

    await expect(store.open(path)).rejects.toMatchObject({ reason: 'too-new' })

    expect(await exists(join(path, MANIFEST_FILE))).toBe(false)
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
    await store.close()

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

    // The promoted copy is a file the studio just created, so it needs the attribute as much as
    // one written by `create` — without it the Explorer shows the dotted manifest beside the old
    // one, and the folder looks like it grew a stray file by being opened.
    it('hides the manifest it migrates from the old name', async () => {
      asWindows()
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

      await store.open(path)

      const hidden = execFileMock.mock.calls.flatMap(([, args]) => args.slice(1))
      expect(hidden.filter(entry => entry.endsWith(MANIFEST_FILE))).toEqual([
        join(path, MANIFEST_FILE),
      ])
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

  it('announces that no project is open once it is closed', async () => {
    await store.create(root, 'My project')
    await store.close()

    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(store.current()).toBeNull()
  })

  /**
   * The same order `activate` keeps before a swap: what is still queued belongs to the project
   * being left, and its catalogue is about to stop answering.
   */
  it('settles what belongs to the project before its catalogue goes', async () => {
    let settled = false
    const settling = createProjectStore({
      openCatalog: async () => memoryCatalog(),
      now: () => clock,
      onChange,
      onRoles: () => {},
      // Read INSIDE the settling: the project still being there is the order this exists for.
      settle: async () => {
        settled = settling.current() !== null
      },
    })

    await settling.create(join(root, 'settling'), 'Settling')
    await settling.close()

    expect(settled).toBe(true)
  })

  /**
   * `touch` replaces the project with a new object carrying a fresh stamp on every document
   * saved, and `autosaveOpenDocuments` fires on a timer from any window. Read by identity, the
   * guard below then took an autosave for another project and left the catalogue open while the
   * window that asked had already gone back to the home.
   */
  it('closes all the same when a save stamped the manifest while it settled', async () => {
    let stamping: (() => void) | null = null
    const stamped = createProjectStore({
      openCatalog: async () => memoryCatalog(),
      now: () => clock,
      onChange,
      onRoles: () => {},
      settle: async () => {
        stamping?.()
      },
    })

    await stamped.create(join(root, 'stamped'), 'Stamped')
    clock = '2026-08-06T11:00:00.000Z'
    stamping = stamped.touch

    await stamped.close()

    expect(stamped.current()).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('announces nothing when there was no project to close', async () => {
    vi.mocked(onChange).mockClear()

    await store.close()

    expect(onChange).not.toHaveBeenCalled()
  })

  /**
   * `projectOpen` and `projectClose` are independent handlers: a closing that settles slowly —
   * a journal flush on a network volume — must not tear down whatever opened meanwhile.
   */
  it('leaves alone a project opened while it was settling', async () => {
    // Held for the closing alone: `activate` settles too, so a hold that outlived the first
    // await would block the very opening this case has to let through.
    let hold: Promise<void> | null = null
    const racing = createProjectStore({
      openCatalog: async () => memoryCatalog(),
      now: () => clock,
      onChange,
      onRoles: () => {},
      settle: async () => {
        if (hold) await hold
      },
    })

    const first = await racing.create(join(root, 'first'), 'First')
    const second = await racing.create(join(root, 'second'), 'Second')
    await racing.open(first.path)

    let release = (): void => {}
    hold = new Promise<void>(resolve => {
      release = resolve
    })

    const closing = racing.close()
    hold = null
    await racing.open(second.path)
    release()
    await closing

    expect(racing.current()).toEqual(second)
    expect(onChange).toHaveBeenLastCalledWith(second)

    await racing.close()
  })

  describe('inspecting a folder before creating in it', () => {
    it('calls an empty folder blank, and one with files of its own occupied', async () => {
      expect(await store.inspect(root)).toBe('blank')

      await writeFile(join(root, 'rush.mp4'), 'x', 'utf8')
      expect(await store.inspect(root)).toBe('occupied')
    })

    // Every folder made on a Mac gets one, and asking the user about it would put a dialog in
    // front of a folder they would rightly call empty.
    it('does not count a hidden entry as content', async () => {
      await writeFile(join(root, '.DS_Store'), 'x', 'utf8')
      expect(await store.inspect(root)).toBe('blank')
    })

    it('recognises a folder that is already a project', async () => {
      const created = await store.create(root, 'My project')
      expect(await store.inspect(created.path)).toBe('project')
    })

    // The catalogue would have two owners for the same files, and the outer project indexes the
    // inner one's assets as its own.
    it('refuses a folder sitting anywhere under a project', async () => {
      await store.create(root, 'Outer')

      await expect(store.inspect(join(root, 'documents'))).rejects.toMatchObject({
        reason: 'nested',
      })
      await expect(store.inspect(join(root, 'assets', 'img', 'deep'))).rejects.toMatchObject({
        reason: 'nested',
      })
    })

    /**
     * The other direction, and the one the picker makes easy: it opens on the folder the last
     * project was made in, so choosing without descending would wrap every project already
     * there — and every later creation under it would then be refused as nested, curable only
     * by deleting a hidden file by hand.
     */
    it('refuses a folder that already holds projects', async () => {
      await store.create(join(root, 'Reel'), 'Reel')
      await store.close()

      await expect(store.inspect(root)).rejects.toMatchObject({ reason: 'holds-projects' })
    })

    // `project.json` is one of the commonest filenames there is, and taking a stray one for a
    // project would refuse every folder under a checkout that holds one, with no way past it.
    it('does not take a stray project.json above the folder for a project', async () => {
      await writeFile(join(root, LEGACY_MANIFEST_FILE), JSON.stringify({ name: 'some tool' }))
      const below = join(root, 'Reel')
      await mkdir(below)

      expect(await store.inspect(below)).toBe('blank')
    })

    // The reason this exists at all: `create` writes a manifest unconditionally, so a caller
    // that took "cannot read it" for "there is none" would replace an identity the user still
    // has documents under.
    it('raises rather than answering, for a manifest that exists but will not parse', async () => {
      await writeFile(join(root, MANIFEST_FILE), 'not json at all', 'utf8')

      await expect(store.inspect(root)).rejects.toThrow(ProjectOpenError)
    })

    it('raises for a project made by a newer build', async () => {
      await writeFile(
        join(root, MANIFEST_FILE),
        JSON.stringify({
          version: MANIFEST_VERSION + 1,
          name: 'Future',
          createdAt: '',
          updatedAt: '',
        }),
        'utf8',
      )

      await expect(store.inspect(root)).rejects.toMatchObject({ reason: 'too-new' })
    })
  })

  it('reopens a project it created', async () => {
    const created = await store.create(root, 'My project')
    await store.close()

    expect(store.current()).toBeNull()
    expect(await store.open(created.path)).toEqual(created)
  })

  it('refuses a manifest it cannot make sense of', async () => {
    const created = await store.create(root, 'My project')
    await writeFile(join(created.path, '.project.json'), '{"name":42}', 'utf8')
    await store.close()

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
    await store.close()

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
      onRoles: () => {},
    })

    const first = await fragile.create(join(root, 'first'), 'First')
    const second = await fragile.create(join(root, 'second'), 'Second')
    await fragile.open(first.path)

    failNext = true

    // The catalogue that failed must not cost the user the one that was working.
    await expect(fragile.open(second.path)).rejects.toThrow('database is locked')
    expect(fragile.current()).toEqual(first)
    expect(() => fragile.catalog()).not.toThrow()

    await fragile.close()
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

/**
 * Renaming a project — the manifest's `name`, never the folder. The folder is what
 * `recentProjects`, `storage.lastProject` and every absolute path in the catalogue are keyed on.
 */
describe('renaming a project', () => {
  let root: string
  let onChange: (project: unknown) => void
  let store: ProjectStore
  let clock: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'scenario-rename-'))
    onChange = vi.fn()
    clock = '2026-08-13T10:00:00.000Z'
    store = createProjectStore({
      openCatalog: async () => memoryCatalog(),
      now: () => clock,
      onChange,
      onRoles: () => {},
    })
  })

  afterEach(async () => {
    await store.close()
    await rm(root, { recursive: true, force: true })
    execFileMock.mockClear()
  })

  const manifestAt = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(path, MANIFEST_FILE), 'utf8'))

  it('writes the new name into the manifest and leaves the folder where it is', async () => {
    const made = await store.create(root, 'Before')

    const renamed = await store.rename(made.path, 'After')

    expect(renamed.path).toBe(made.path)
    expect(renamed.manifest.name).toBe('After')
    expect(await exists(made.path)).toBe(true)
    expect(await manifestAt(made.path)).toMatchObject({ name: 'After' })
  })

  /**
   * `createdAt` is what both surfaces ORDER the projects by since 13 August. A rename that stamped
   * it would move the row it renamed to the top of the list — the exact reshuffle that key exists
   * to prevent, arriving through the one gesture that reads as harmless.
   */
  it('never touches the date the project was made', async () => {
    const made = await store.create(root, 'Before')
    clock = '2026-12-25T00:00:00.000Z'

    const renamed = await store.rename(made.path, 'After')

    expect(renamed.manifest.createdAt).toBe(made.manifest.createdAt)
    expect(renamed.manifest.updatedAt).toBe('2026-12-25T00:00:00.000Z')
  })

  it('replaces the open project in memory, so the studio reads the new name at once', async () => {
    const made = await store.create(root, 'Before')

    await store.rename(made.path, 'After')

    expect(store.current()?.manifest.name).toBe('After')
  })

  /**
   * `onChange` means "another project is in front now": it resumes remembered jobs and re-arms the
   * folder watch. Firing it for a rename would double-track running jobs to update a word.
   */
  it('does not announce a project change', async () => {
    const made = await store.create(root, 'Before')
    vi.mocked(onChange).mockClear()

    await store.rename(made.path, 'After')

    expect(onChange).not.toHaveBeenCalled()
  })

  // The home's shelf lists projects that are not open, and renaming one must not open it.
  it('renames a project that is not open, without opening it', async () => {
    const other = await store.create(join(root, 'other'), 'Other')
    const open = await store.create(join(root, 'open'), 'Open')

    const renamed = await store.rename(other.path, 'Renamed')

    expect(renamed.manifest.name).toBe('Renamed')
    expect(await manifestAt(other.path)).toMatchObject({ name: 'Renamed' })
    // Still the one that was open, and its manifest untouched.
    expect(store.current()?.path).toBe(open.path)
    expect(await manifestAt(open.path)).toMatchObject({ name: 'Open' })
  })

  // A folder gone since the shelf last saw it is the ordinary case there, and it must not be
  // reported as anything other than what opening it would report.
  it('refuses a folder that is not a project', async () => {
    await expect(store.rename(join(root, 'nowhere'), 'Name')).rejects.toThrow(ProjectOpenError)
  })
})

/**
 * What the asset scheme reads to know whether a refusal is « the project has gone » or a defect.
 * Told apart nowhere else: both arrive as a rejected promise on the same call.
 */
describe('telling a project that has gone from something that broke', () => {
  it('recognises no project open, and a catalogue closed under a request in flight', () => {
    expect(isCatalogueGone(new NoProjectError())).toBe(true)
    expect(isCatalogueGone(new Error(CATALOGUE_CLOSED))).toBe(true)
  })

  // The whole point: a resolver that throws for its own reasons must keep travelling, so that
  // `servedPath` journals it as the defect it is instead of serving it as a quiet 404.
  it('does not recognise a defect, however it is spelled', () => {
    expect(isCatalogueGone(new TypeError('find is not a function'))).toBe(false)
    expect(isCatalogueGone(new Error('catalogue thread failed: out of memory'))).toBe(false)
    expect(isCatalogueGone('catalogue is closed')).toBe(false)
  })

  /**
   * The shape, and the reason this takes a thunk: `project.catalog()` throws BEFORE any promise
   * exists, so a `.catch()` hung off the call is never attached and the throw leaves by the
   * stack — reaching the scheme as a defect on a path that is merely a project being left.
   */
  it('answers for a read that throws before it ever returns a promise', async () => {
    await expect(
      orWhenGone(() => {
        throw new NoProjectError()
      }, null),
    ).resolves.toBeNull()

    await expect(
      orWhenGone<readonly string[]>(() => {
        throw new Error(CATALOGUE_CLOSED)
      }, []),
    ).resolves.toEqual([])
  })

  it('hands back what the read answered, and lets a defect travel', async () => {
    await expect(orWhenGone(() => Promise.resolve('a file'), null)).resolves.toBe('a file')
    await expect(orWhenGone(() => Promise.reject(new TypeError('broke')), null)).rejects.toThrow(
      TypeError,
    )
  })
})
