import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import {
  CATALOG_FILE,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  LEGACY_MANIFEST_FILE,
  PROJECT_FOLDERS,
  type Manifest,
  type Project,
} from '@shared/domain/project'
import { isRecord } from '@shared/guards'
import { log } from '@main/log'
import { isMissing, writeAtomic, writeQueue } from '@main/persistence'
import type { AsyncCatalog } from './catalog-client'
import { parseManifest } from './validation'

/** Thrown when a channel needing a project is reached before one is open. */
export class NoProjectError extends Error {
  constructor() {
    super('no-project')
    this.name = 'NoProjectError'
  }
}

/**
 * Why a folder would not open as a project. The three cases the user can act on, and they ask
 * for three different sentences: pick another folder, repair this one, or update the studio.
 */
export type ProjectOpenFailure = 'not-a-project' | 'unreadable' | 'too-new'

/**
 * One error carrying a reason rather than three classes: what every caller does with it is
 * choose a sentence, and a union keeps that choice exhaustive. `cause` holds what actually
 * threw — for the log, never for the user.
 */
export class ProjectOpenError extends Error {
  constructor(
    readonly reason: ProjectOpenFailure,
    cause?: unknown,
  ) {
    super(reason, { cause })
    this.name = 'ProjectOpenError'
  }
}

const OPEN_FAILURE_KEYS: Record<ProjectOpenFailure, string> = {
  'not-a-project': 'activity.projectNotAProject',
  unreadable: 'activity.projectUnreadable',
  'too-new': 'activity.projectTooNew',
}

/**
 * What the user reads when a folder will not open, or nothing for a failure that is not about
 * the folder — a disk that gave out mid-open is not a sentence about the choice they made.
 *
 * Beside the error rather than in the handler: two paths open a project, the picker and the
 * reopening at startup, and only one of them goes through a channel.
 */
export function openFailureKey(error: unknown): string | null {
  return error instanceof ProjectOpenError ? OPEN_FAILURE_KEYS[error.reason] : null
}

export type ProjectStoreDeps = {
  /** Resolves once the database is open and migrated — see `openCatalogThread`. */
  openCatalog: (file: string) => Promise<AsyncCatalog>
  now: () => string
  onChange: (project: Project | null) => void
  /** Writes out whatever still belongs to the project being closed, before its catalogue goes. */
  settle?: () => Promise<void>
}

export type ProjectStore = {
  create: (parentFolder: string, name: string) => Promise<Project>
  open: (path: string) => Promise<Project>
  current: () => Project | null
  /** The open project's folder. Throws rather than letting a write land outside a project. */
  path: () => string
  /** The open project's catalogue. Throws rather than answering an empty one. */
  catalog: () => AsyncCatalog
  /**
   * Stamps the manifest with the moment the project last did some work. Called on every document
   * saved, so it never throws and never makes a caller wait: what it says is nice to have, and a
   * save that failed over it would be a real loss for a cosmetic one.
   */
  touch: () => void
  /**
   * Resolves once the stamp `touch` fired is on disk — what the shutdown awaits, so a studio
   * quit right after a save does not leave the write it started behind.
   */
  settled: () => Promise<void>
  close: () => void
}

const execFile = promisify(execFileCallback)

/**
 * Indented, because a project folder is meant to be opened by hand — and atomic, because this
 * is now written on every document saved rather than once at creation: a process that dies
 * mid-write would otherwise leave the file that carries the project's identity truncated, and
 * the folder would stop opening at all.
 */
async function writeManifest({ path, manifest }: Project): Promise<void> {
  await writeAtomic(join(path, MANIFEST_FILE), JSON.stringify(manifest, null, 2))
}

async function ensureFolders(root: string): Promise<void> {
  await Promise.all(PROJECT_FOLDERS.map(folder => mkdir(join(root, folder), { recursive: true })))
  await hideFromExplorer(join(root, '.index'))
}

/**
 * A leading dot hides on macOS and Linux and means nothing on Windows, which reads the
 * FILE_ATTRIBUTE_HIDDEN bit that Node does not expose. `attrib` is the only way to set it
 * without a native module, and it costs one short process per project rather than per file.
 *
 * Failures are swallowed on purpose: a manifest the Explorer happens to show is a cosmetic
 * problem, and refusing to open the project over it would be a real one.
 */
async function hideFromExplorer(path: string): Promise<void> {
  if (process.platform !== 'win32') return

  try {
    await execFile('attrib', ['+h', path])
  } catch {
    return
  }
}

/** A manifest body, and whether it came from the name projects carried before the rename. */
type ManifestSource = { body: string; legacy: boolean }

/**
 * The manifest, under whichever name the folder carries it. The dotted file wins when both are
 * there: a project opened once since the rename keeps the old one beside it, and the stale copy
 * must not be what the studio believes.
 */
async function readManifest(path: string): Promise<ManifestSource> {
  try {
    return { body: await readFile(join(path, MANIFEST_FILE), 'utf8'), legacy: false }
  } catch (error) {
    // Only an ABSENT file means "made before the rename". Any other failure — permissions, a
    // folder in its place, a sync placeholder — is a manifest that exists, and taking it for a
    // missing one would read the stale copy beside it.
    if (!isMissing(error)) throw error

    return { body: await readFile(join(path, LEGACY_MANIFEST_FILE), 'utf8'), legacy: true }
  }
}

/**
 * Copies a legacy manifest under the hidden name, so the parc converges on its own rather than
 * on the next release. Called only once the body has been understood: the dotted file wins every
 * later open, so promoting one this build could not parse would bury the healthy copy beside it.
 *
 * The old file is left where it is rather than deleted — a folder the user may be syncing is
 * not ours to tidy, and an older build of the studio still reads it.
 */
async function migrateManifest(path: string, body: string): Promise<void> {
  // Best effort: a read-only folder still opens, it just migrates on the next writable one.
  await writeFile(join(path, MANIFEST_FILE), body, 'utf8').catch(() => undefined)
  await hideFromExplorer(join(path, MANIFEST_FILE))
}

/**
 * The manifest of a folder, or the reason it is not a project.
 *
 * Named failures rather than whatever `readFile` and zod happened to throw: the four callers of
 * `open` all do `void openPicked()`, so what reached the user was an `ENOENT` — a sentence about
 * a path they never typed, for a folder they picked with a dialog.
 */
async function loadManifest(path: string): Promise<Manifest> {
  let source: ManifestSource
  try {
    source = await readManifest(path)
  } catch (error) {
    // No manifest under either name is a folder picked by mistake. Anything else — permissions,
    // a folder where the file belongs — is a project that exists and will not open.
    throw new ProjectOpenError(isMissing(error) ? 'not-a-project' : 'unreadable', error)
  }

  let head: unknown
  try {
    head = JSON.parse(source.body)
  } catch (error) {
    throw new ProjectOpenError('unreadable', error)
  }

  // Read before the schema caps it: zod turns "too new" and "malformed" into the same failure,
  // and those two ask the user for opposite things — update the studio, or repair the file.
  // Integers only: `1.5` is a broken manifest, and telling its owner to update would send them
  // after a release that will never fix it.
  if (isRecord(head) && Number.isInteger(head.version) && Number(head.version) > MANIFEST_VERSION) {
    throw new ProjectOpenError('too-new')
  }

  let manifest: Manifest
  try {
    manifest = parseManifest(head)
  } catch (error) {
    throw new ProjectOpenError('unreadable', error)
  }

  if (source.legacy) await migrateManifest(path, source.body)

  return manifest
}

export function createProjectStore({
  openCatalog,
  now,
  onChange,
  settle,
}: ProjectStoreDeps): ProjectStore {
  let project: Project | null = null
  let catalog: AsyncCatalog | null = null
  /** Two stamps a millisecond apart must not have the older one land last. */
  const writes = writeQueue()

  const close = (): void => {
    // The thread is told to stop, but nothing waits for it: a project is closed from menus and
    // from IPC handlers that have no use for the moment a thread actually exits.
    void catalog?.close().catch((error: unknown) => {
      log.warn('project', `closing the catalogue failed: ${String(error)}`)
    })
    catalog = null
    project = null
  }

  /**
   * The new catalogue is opened before the current one is dropped. The other way round, a
   * database that fails to open — corrupt, locked, on a full disk — would leave the studio
   * with no project at all while the interface still showed the previous one as open.
   */
  const activate = async (opened: Project): Promise<Project> => {
    const file = join(opened.path, CATALOG_FILE)
    await mkdir(dirname(file), { recursive: true })

    const opening = await openCatalog(file)

    // Whatever is still queued belongs to the project that is closing, and its catalogue is
    // about to stop answering. The stamp goes with it: it is being written into the folder the
    // studio is about to leave.
    await Promise.all([settle?.(), writes.settled()])

    close()
    catalog = opening
    project = opened
    onChange(opened)
    return opened
  }

  return {
    create: async (parentFolder, name) => {
      const root = join(parentFolder, name)
      await ensureFolders(root)

      const timestamp = now()
      const made: Project = {
        path: root,
        manifest: {
          version: MANIFEST_VERSION,
          name,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      }
      await writeManifest(made)
      await hideFromExplorer(join(root, MANIFEST_FILE))

      return await activate(made)
    },

    open: async path => {
      const manifest = await loadManifest(path)

      // Repairs a project whose subfolders were deleted between two sessions — the folder is
      // the user's, and a missing `assets/vid` must not stop it from opening.
      await ensureFolders(path)

      return await activate({ path, manifest })
    },

    current: () => project,

    path: () => {
      if (!project) throw new NoProjectError()
      return project.path
    },

    catalog: () => {
      if (!catalog) throw new NoProjectError()
      return catalog
    },

    touch: () => {
      const stamped = now()
      if (!project || project.manifest.updatedAt === stamped) return

      // The in-memory copy first: two saves in the same millisecond then cost one write, and
      // whatever reads the open project sees the stamp without waiting for the disk.
      const stamping = { ...project, manifest: { ...project.manifest, updatedAt: stamped } }
      project = stamping

      void writes
        .next(() => writeManifest(stamping))
        .catch((error: unknown) => {
          log.warn('project', `stamping the manifest failed: ${String(error)}`)
        })
    },

    settled: writes.settled,

    close: () => {
      close()
      onChange(null)
    },
  }
}
