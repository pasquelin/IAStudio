import { execFile as execFileCallback } from 'node:child_process'
import type { Dir } from 'node:fs'
import { mkdir, opendir, readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import {
  CATALOG_FILE,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  LEGACY_MANIFEST_FILE,
  MACHINE_FOLDERS,
  STARTER_FOLDERS,
  type Manifest,
  type Project,
} from '@shared/domain/project'
import type { ActivityMessageKey } from '@shared/domain/activity'
import { isHiddenEntry } from '@shared/domain/folder'
import { isRecord } from '@shared/guards'
import { log } from '@main/log'
import { exists, isMissing, writeAtomic, writeQueue } from '@main/persistence'
import { CATALOGUE_CLOSED, type AsyncCatalog } from './catalogClient'
import { applyJournal } from './fileJournal'
import { parseManifest } from './validation'

/** Thrown when a channel needing a project is reached before one is open. */
export class NoProjectError extends Error {
  constructor() {
    super('no-project')
    this.name = 'NoProjectError'
  }
}

/**
 * Whether a refusal means the project has GONE rather than that something broke. A thread that
 * DIED is deliberately not one of them — it rejects with its own reason, and that is news.
 *
 * `NoProjectError` is an assurance, not a live branch: `project` and `catalog` are assigned in
 * one tick, so no caller reading both without an `await` between them can meet it. It stays
 * because `catalog()` throws it, and a caller that DOES await between the two would.
 */
export function isCatalogueGone(error: unknown): boolean {
  if (error instanceof NoProjectError) return true
  return error instanceof Error && error.message === CATALOGUE_CLOSED
}

/**
 * Why a folder would not serve as a project. Each case asks the user for a different thing: pick
 * another folder, repair this one, update the studio, or — for a folder sitting inside a project
 * already — pick one that is not there.
 */
export type ProjectOpenFailure =
  'not-a-project' | 'unreadable' | 'too-new' | 'nested' | 'holds-projects'

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

const OPEN_FAILURE_KEYS: Record<ProjectOpenFailure, ActivityMessageKey> = {
  'not-a-project': 'activity.projectNotAProject',
  unreadable: 'activity.projectUnreadable',
  'too-new': 'activity.projectTooNew',
  nested: 'activity.projectNested',
  'holds-projects': 'activity.projectHoldsProjects',
}

/**
 * What the user reads when a folder will not open, or nothing for a failure that is not about
 * the folder — a disk that gave out mid-open is not a sentence about the choice they made.
 *
 * Beside the error rather than in the handler: two paths open a project, the picker and the
 * reopening at startup, and only one of them goes through a channel.
 */
export function openFailureKey(error: unknown): ActivityMessageKey | null {
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

/** What a folder offers a creation aimed at it: open the project there, ask first, or write. */
export type FolderVerdict = 'project' | 'occupied' | 'blank'

export type ProjectStore = {
  /**
   * Installs a project INTO `path`, which becomes its root — no folder is made from the name.
   * Call `inspect` first: this writes a manifest over whatever is there.
   */
  create: (path: string, name: string) => Promise<Project>
  /**
   * What creating a project at `path` would mean, so nothing is written over.
   *
   * A folder that cannot serve at all raises instead of answering, as opening does: a manifest
   * this build cannot understand — `unreadable`, `too-new` — must stop the gesture rather than
   * be replaced by a fresh one, and so must a folder sitting under a project already.
   */
  inspect: (path: string) => Promise<FolderVerdict>
  open: (path: string) => Promise<Project>
  /**
   * Writes a new name into a project's manifest — the FOLDER is never touched, see the channel's
   * own doc for why. Works on a project that is not open, which the home's shelf needs.
   *
   * When the renamed one IS open, its in-memory copy is replaced too. `onChange` is deliberately
   * NOT fired: it means "another project is in front now", and it resumes remembered jobs and
   * re-arms the folder watch — a rename would double-track running jobs to update a word.
   */
  rename: (path: string, name: string) => Promise<Project>
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

/**
 * The machine's own, put back on every open: they hold a rebuildable cache, and a project whose
 * `.index/peaks` was deleted between two sessions must still open.
 */
async function ensureMachineFolders(root: string): Promise<void> {
  await Promise.all(MACHINE_FOLDERS.map(folder => mkdir(join(root, folder), { recursive: true })))
  await hideFromExplorer(join(root, '.index'))
}

/**
 * The folders a project STARTS with — laid down once, at creation, and never put back.
 *
 * That is the whole of what makes them ordinary: a user who threw `Images/` away meant to, and a
 * folder that came back at the next open would be the old layout wearing a new name. An import
 * with nowhere else to go recreates the one it needs (`freeAssetPath`), which is a different
 * thing — it happens because something is being written, not because a project was opened.
 */
async function createStarterFolders(root: string): Promise<void> {
  await Promise.all(STARTER_FOLDERS.map(folder => mkdir(join(root, folder), { recursive: true })))
}

/**
 * The folders above `path`, nearest first, up to the volume root — which is where it stops:
 * `dirname` answers a root with the root itself, and getting that wrong spins forever.
 */
function ancestorsOf(path: string): string[] {
  const found: string[] = []

  for (let child = path, parent = dirname(child); parent !== child; parent = dirname(child)) {
    found.push(parent)
    child = parent
  }

  return found
}

/**
 * Whether a folder is a project root, by the presence of the manifest the studio WRITES.
 *
 * The legacy name is deliberately not accepted here, though `readManifest` still reads it: this
 * asks about folders nobody chose, and `project.json` is one of the most common filenames there
 * is. Taking one for a project would refuse every folder under a checkout that happens to hold
 * one, with a sentence about a project that does not exist and no way past it.
 */
const hasManifest = (folder: string): Promise<boolean> => exists(join(folder, MANIFEST_FILE))

/** What is already in a folder: whether the user would call it empty, and its subfolders. */
type FolderSurvey = { visible: boolean; children: string[] }

/**
 * One pass over the folder, answering both questions a creation has about it.
 *
 * Hidden entries count for neither: a `.DS_Store` the Finder left behind is not content, and
 * treating it as such would put a question in front of every folder made on a Mac.
 *
 * Read through `opendir` rather than listed: only the subfolder names are kept, so a `~/Downloads`
 * holding tens of thousands of files is walked without allocating a name for each. It IS walked
 * to the end — a project three entries from the last one still has to be found.
 */
async function surveyFolder(folder: string): Promise<FolderSurvey> {
  let dir: Dir
  try {
    dir = await opendir(folder)
  } catch (error) {
    // A folder that is not there yet holds nothing — `create` is what makes it.
    if (isMissing(error)) return { visible: false, children: [] }
    throw error
  }

  const survey: FolderSurvey = { visible: false, children: [] }
  try {
    for await (const entry of dir) {
      if (isHiddenEntry(entry.name)) continue

      survey.visible = true
      if (entry.isDirectory()) survey.children.push(join(folder, entry.name))
    }
  } finally {
    // Closed by the iterator when it runs out, and NOT when it is left early: a throw partway
    // would leak the handle, which on Windows also keeps the folder locked.
    await dir.close().catch(() => undefined)
  }

  return survey
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
 * on the next release. Called only once the body has been understood, and atomic: the dotted
 * file wins every later open, whatever it holds, so a body this build could not parse — or one
 * torn in half by a write — buries the healthy copy beside it.
 *
 * The old file is left where it is rather than deleted — a folder the user may be syncing is
 * not ours to tidy, and an older build of the studio still reads it.
 */
async function promoteManifest(path: string, body: string): Promise<void> {
  await writeAtomic(join(path, MANIFEST_FILE), body).catch(() => undefined)
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

  if (source.legacy) await promoteManifest(path, source.body)

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

    /**
     * A move interrupted last session left rows naming where their files used to be. Finished
     * here, on a catalogue nothing is reading yet and BEFORE the studio is told anything — the
     * four lines below have to stay one gesture, and an `await` among them let a second opening
     * publish itself in the middle and be overwritten by the first.
     *
     * Caught rather than awaited into the failure: opening a project must not fail over
     * housekeeping. The rows stay where they are, and the reconciliation pass finds them.
     */
    try {
      const caught = await applyJournal(opened.path, opening)
      if (caught > 0) log.info('project', `finished ${caught} move(s) left by a previous session`)
    } catch (error) {
      log.warn('project', `replaying the move journal failed: ${String(error)}`)
    }

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
    create: async (path, name) => {
      await ensureMachineFolders(path)
      await createStarterFolders(path)

      const timestamp = now()
      const made: Project = {
        path,
        manifest: {
          version: MANIFEST_VERSION,
          name,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      }
      await writeManifest(made)
      await hideFromExplorer(join(path, MANIFEST_FILE))

      return await activate(made)
    },

    inspect: async path => {
      try {
        await loadManifest(path)
        return 'project'
      } catch (error) {
        // Only "no manifest at all" leaves room for a new project. Anything else — a torn file,
        // a version this build cannot read — is a project that exists, and creating over it
        // would replace an identity the user still has documents under.
        const missing = error instanceof ProjectOpenError && error.reason === 'not-a-project'
        if (!missing) throw error
      }

      // Two projects sharing files give the catalogue two owners for them, and the outer one
      // indexes the inner one's assets as its own. Both directions are refused, and the second
      // is the one the picker makes easy: it opens on the folder the last project was made in,
      // so choosing without descending would wrap every project already there.
      //
      // Asked of every ancestor at once: the common answer is "none of them", which has to read
      // them all anyway, and a walk that stopped early would queue round-trips on a network
      // volume to save none here.
      const above = await Promise.all(ancestorsOf(path).map(hasManifest))
      if (above.includes(true)) throw new ProjectOpenError('nested')

      const { visible, children } = await surveyFolder(path)

      // Direct children only. A project buried deeper is not what a folder chosen to hold
      // projects looks like, and walking a whole subtree to find one would price this gesture
      // on the size of the disk.
      const inside = await Promise.all(children.map(hasManifest))
      if (inside.includes(true)) throw new ProjectOpenError('holds-projects')

      return visible ? 'occupied' : 'blank'
    },

    open: async path => {
      const manifest = await loadManifest(path)

      // The caches only. What the user arranged is theirs, deletions included.
      await ensureMachineFolders(path)

      return await activate({ path, manifest })
    },

    rename: async (path, name) => {
      // Read from disk rather than from the open project, even when they are the same folder: this
      // is the only way one path serves both cases, and the manifest on disk is the truth anyway.
      const manifest = await loadManifest(path)
      const renamed: Project = { path, manifest: { ...manifest, name, updatedAt: now() } }

      // Through the queue, and it is not optional: `touch` writes this same file on every document
      // saved, so a rename racing a save would lose whichever landed first.
      await writes.next(() => writeManifest(renamed))

      if (project?.path === path) project = renamed

      return renamed
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
