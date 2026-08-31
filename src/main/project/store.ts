import { orElse } from '@shared/promises'
import type { Dir } from 'node:fs'
import { mkdir, opendir, readFile, rename as renameFolder, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  CATALOG_FILE,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  LEGACY_MANIFEST_FILE,
  MACHINE_FOLDERS,
  type Manifest,
  type Project,
  type ProjectOpenFailure,
  type ProjectRenameFailure,
} from '@shared/domain/project'
import type { ActivityMessageKey } from '@shared/domain/activity'
import { isHiddenEntry } from '@shared/domain/folder'
import { isSafeFileName } from '@shared/domain/fileName'
import type { FolderRole, RoleFolders } from '@shared/domain/folderRole'
import { isRecord } from '@shared/guards'
import { log } from '@main/log'
import { exists, isMissing, writeAtomic, writeQueue } from '@main/persistence'
import { CATALOGUE_CLOSED, type AsyncCatalog } from './catalogClient'
import { applyJournal } from './fileJournal'
import { ensureRoleFolder, layRoleFolders, resolveRoleFolders, writeRoleCache } from './folderRoles'
import { hideFromExplorer } from './hideFromExplorer'
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
 * A catalogue read, with the project going answered by `gone` rather than by a rejection.
 *
 * Takes a THUNK, not a promise: `catalog()` throws before any promise exists, so a `.catch()`
 * hung off the call is never attached and the throw leaves by the stack instead.
 */
export async function orWhenGone<T>(read: () => Promise<T>, gone: T): Promise<T> {
  try {
    return await read()
  } catch (error: unknown) {
    if (isCatalogueGone(error)) return gone
    throw error
  }
}

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

/**
 * Thrown when a project cannot take a name. Apart from `ProjectOpenError`, which answers about a
 * FOLDER: these two are about the name asked for, and the folder is fine.
 */
export class ProjectRenameError extends Error {
  constructor(readonly reason: ProjectRenameFailure) {
    super(reason)
    this.name = 'ProjectRenameError'
  }
}

const RENAME_FAILURE_KEYS: Record<ProjectRenameFailure, ActivityMessageKey> = {
  'unsafe-name': 'activity.projectNameUnsafe',
  taken: 'activity.projectNameTaken',
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
  if (error instanceof ProjectRenameError) return RENAME_FAILURE_KEYS[error.reason]

  return error instanceof ProjectOpenError ? OPEN_FAILURE_KEYS[error.reason] : null
}

export type ProjectStoreDeps = {
  /** Resolves once the database is open and migrated — see `openCatalogThread`. */
  openCatalog: (file: string) => Promise<AsyncCatalog>
  now: () => string
  onChange: (project: Project | null) => void
  /**
   * Where the roles sit, whenever that changes. Apart from `onChange`, which resumes jobs and
   * re-arms the folder watch: a folder appearing must not cost that.
   */
  onRoles: (roles: RoleFolders) => void
  /** Writes out whatever still belongs to the project being closed, before its catalogue goes. */
  settle?: () => Promise<void>
}

/** What a folder offers a creation aimed at it: open the project there, ask first, or write. */
export type FolderVerdict = 'project' | 'occupied' | 'blank'

export type ProjectStore = {
  /**
   * Installs a project INTO `path`, which becomes its root AND its name — see `projectName`.
   * Call `inspect` first: this writes a manifest over whatever is there.
   */
  create: (path: string) => Promise<Project>
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
  /** Where each role's folder sits — for DRAWING. A write asks `folderFor`, which lays it down. */
  roles: () => RoleFolders
  /** The folder a role names, laid down with its marker if the project has none. */
  folderFor: (role: FolderRole) => Promise<string>
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
  /**
   * Leaves no project open. Settles first, as `activate` does before a swap: what is still
   * queued belongs to the project being left, and its catalogue is about to stop answering.
   */
  close: () => Promise<void>
}

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
    await orElse(dir.close(), undefined)
  }

  return survey
}

/** A manifest body, and whether it came from the name projects carried before the rename. */
type ManifestSource = { body: string; legacy: boolean }

/** Whether two paths name the one folder — what a case-folding volume answers `true` to. */
async function sameFolder(one: string, other: string): Promise<boolean> {
  try {
    const [first, second] = await Promise.all([stat(one), stat(other)])
    return first.ino === second.ino && first.dev === second.dev
  } catch {
    // Either is gone between the check and here: not the same folder, and the rename below says so.
    return false
  }
}

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
  await orElse(writeAtomic(join(path, MANIFEST_FILE), body), undefined)
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
  onRoles,
  settle,
}: ProjectStoreDeps): ProjectStore {
  let project: Project | null = null
  let catalog: AsyncCatalog | null = null
  /** Where each role's folder was last found. Empty between projects, partial when one is gone. */
  let roleFolders: RoleFolders = {}
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

  /** The renamed project kept in memory, for a rename that moved nothing on disk. */
  const holding = (renamed: Project): Project => {
    project = renamed
    return renamed
  }

  /**
   * The folder under its new name, or where it already was when the two are the SAME folder.
   *
   * 🛑 Measured by inode, never deduced from the platform: APFS and NTFS fold case, ext4 does
   * not, so `jeu1` → `Jeu1` is a plain rename on one volume and "that name is taken" on another
   * — and `process.platform` answers for neither, since the volume is what decides.
   */
  const movedFolder = async (path: string, folder: string): Promise<string> => {
    if (folder === path) return path
    if ((await exists(folder)) && !(await sameFolder(path, folder))) {
      throw new ProjectRenameError('taken')
    }

    await renameFolder(path, folder)
    return folder
  }

  /**
   * The new catalogue is opened before the current one is dropped. The other way round, a
   * database that fails to open — corrupt, locked, on a full disk — would leave the studio
   * with no project at all while the interface still showed the previous one as open.
   */
  const activate = async (opened: Project): Promise<Project> => {
    const file = join(opened.path, CATALOG_FILE)
    await mkdir(dirname(file), { recursive: true })

    // Started here and awaited below: it depends on the folder alone, so it runs under the
    // catalogue opening and the journal replay rather than after them — and the four lines that
    // publish the project must stay free of any `await`, see below.
    const resolving = readRoles(opened.path)

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
    const resolved = await resolving
    await Promise.all([settle?.(), writes.settled()])

    close()
    catalog = opening
    project = opened
    roleFolders = resolved
    /**
     * 🛑 Fired for a RENAME too, and staying silent there cost more than it saved: `onChange` is
     * the only thing that redirects the folder watch, follows the assistant's memory and settles
     * the account link — all of which stayed on a folder that had just moved.
     */
    onChange(opened)
    onRoles(resolved)
    return opened
  }

  /** Whether the map points a role at a folder the disk no longer holds — a rename, a deletion. */
  const roleFolderMissing = async (
    root: string,
    held: RoleFolders,
    role: FolderRole,
  ): Promise<boolean> => {
    const folder = held[role]
    return folder !== undefined && !(await exists(join(root, folder)))
  }

  /** Never fatal: a project whose roles cannot be read opens with none, and the first write lays
   * the folder it needs back down. Losing a role costs a folder, never a project. */
  const readRoles = async (root: string): Promise<RoleFolders> => {
    try {
      const { roles, walked } = await resolveRoleFolders(root)
      if (walked) await writeRoleCache(root, roles)
      return roles
    } catch (error) {
      log.warn('project', `reading the folder roles failed: ${String(error)}`)
      return {}
    }
  }

  return {
    create: async path => {
      await ensureMachineFolders(path)
      // Laid down once, and never put back on a later open: a user who threw `Images/` away
      // meant to, and a folder that came back would be the old layout wearing a new name.
      await layRoleFolders(path)

      const timestamp = now()
      const made: Project = {
        path,
        manifest: {
          version: MANIFEST_VERSION,
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
      if (!isSafeFileName(name)) throw new ProjectRenameError('unsafe-name')

      const folder = join(dirname(path), name)
      const moved = await movedFolder(path, folder)
      const renamed: Project = { path: moved, manifest: { ...manifest, updatedAt: now() } }

      // Through the queue, and it is not optional: `touch` writes this same file on every document
      // saved, so a rename racing a save would lose whichever landed first.
      await writes.next(() => writeManifest(renamed))

      // 🛑 Reopened rather than patched: the catalogue is a thread holding a file INSIDE the folder
      // that just moved, and `activate` is the one place that closes one and opens the next.
      if (project?.path === path) return moved === path ? holding(renamed) : await activate(renamed)

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

    roles: () => roleFolders,

    folderFor: async role => {
      if (!project) throw new NoProjectError()

      // Captured BEFORE the awaits: `close()` nulls `project`, and an opening that landed during
      // one of them would otherwise write this project's roles into the next one's cache.
      const root = project.path

      // A folder renamed while the project is OPEN leaves the map naming where it used to be —
      // and laying the default back down would orphan the folder the user just renamed, marker
      // and all. Re-resolved instead: the marker travelled with it, so the walk finds it.
      const held = (await roleFolderMissing(root, roleFolders, role))
        ? await readRoles(root)
        : roleFolders

      const folder = await ensureRoleFolder(root, held, role)
      const settled = { ...held, [role]: folder }
      if (roleFolders[role] !== folder || held !== roleFolders) {
        roleFolders = settled
        await writeRoleCache(root, settled)
        onRoles(settled)
      }

      return folder
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

    close: async () => {
      // The PATH, not the object: `touch` replaces the project with a new one carrying a fresh
      // stamp on every document saved, and an autosave landing during the settling below would
      // make an identity check read as "another project opened" on the very same folder.
      const leaving = project?.path
      // Nothing open: a second window asking, or a direct call on the channel. Announcing a
      // change nobody made re-arms the folder watch and republishes the machine for nothing.
      if (leaving === undefined) return

      await Promise.all([settle?.(), writes.settled()])
      // `projectOpen` is an independent handler, so a project opened while this awaited would
      // otherwise be the one torn down here.
      if (project?.path !== leaving) return

      close()
      // Emptied with the project, as the field's own line promises: `bundledTextures` and the
      // legacy-layout note both read this, and the paths of a folder nobody has open answer for
      // a project that is no longer there.
      roleFolders = {}
      onChange(null)
      onRoles(roleFolders)
    },
  }
}
