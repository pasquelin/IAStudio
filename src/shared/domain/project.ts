import { byCodeUnit } from '../text'
import type { AccountSummary } from './account'
import { ASSET_FOLDERS } from './asset'
import { DOCUMENTS_FOLDER } from './document'

export const MANIFEST_VERSION = 1

/**
 * A project is a folder, not a binary file — versionable, inspectable, repairable by hand.
 *
 * Hidden because it is not the user's: what the folder holds FOR them — `assets/`, `documents/`
 * — stays in the open, and only what the machine keeps goes under a dot. There is no extension
 * on the folder itself: nothing was ever registered against `.scenario`, so it opened as a
 * plain folder and the suffix only decorated it.
 */
export const MANIFEST_FILE = '.project.json'

/** What projects made before the rename carry. Read, never written — see `openManifest`. */
export const LEGACY_MANIFEST_FILE = 'project.json'

export const CATALOG_FILE = '.index/catalog.db'

/**
 * Where a move that is under way writes down what it has already done.
 *
 * Moving three hundred files is not one operation the filesystem can undo: it is three hundred,
 * and a machine that stops in the middle leaves the project half moved. The journal is what lets
 * the next opening finish the job — see `file-journal.ts`.
 *
 * Under `.index/` because it is machinery the studio can rebuild, not the user's work.
 */
export const PENDING_FILES_FILE = '.index/pending-files.ndjson'

export type Manifest = {
  version: number
  name: string
  createdAt: string
  updatedAt: string
}

export type Project = {
  path: string
  manifest: Manifest
}

/**
 * A project the studio has opened before. Session state kept beside `storage.lastProject`, for
 * the same reason it is: the settings are replicated in every window, so the home reads the
 * list without a channel of its own.
 *
 * The name is stored rather than derived from the folder: a project renamed in its manifest
 * would otherwise be listed under the name of the folder it happens to sit in.
 */
export type RecentProject = {
  path: string
  name: string
  /** ISO 8601, stamped when it was last opened. What decides which entry is evicted. */
  openedAt: string
  /**
   * ISO 8601, copied from the manifest — when the PROJECT was made, not when it was last touched.
   * What decides the order it is listed in.
   *
   * Optional because a settings file written before 13 August has no such field, and dropping
   * those entries to make it required would empty the list of anyone upgrading. Read through
   * `listedAt`, never directly.
   */
  createdAt?: string
}

/**
 * The date a project is ORDERED by, falling back to when it was last opened for an entry stored
 * before `createdAt` existed. A missing value must not sort as the epoch: that would bury every
 * project this studio already knows under the first one made after the upgrade.
 */
export function listedAt(entry: RecentProject): string {
  return entry.createdAt ?? entry.openedAt
}

/**
 * The list as the studio SHOWS it: newest project first, by the date it was created.
 *
 * Apart from the stored order on purpose, and the two answer different questions. Storage is
 * ordered by opening because that is what decides which entry `RECENT_PROJECTS_MAX` evicts —
 * sorting the stored array by creation instead would throw away the oldest project one owns, which
 * may well be the one opened every morning. What the eye wants is a list that does not reshuffle
 * under the click that opens something, and creation date is the only key a click cannot move.
 *
 * The path breaks a tie, so two projects made in the same second do not swap between renders.
 *
 * Neither key is read as words, so neither takes a collator: a stamp sorts chronologically by code
 * unit, and the path is here to be STABLE rather than to be read — a tie broken in the locale the
 * OS was installed in would break it two ways on two machines, which is the one thing a
 * tie-breaker must not do.
 */
export function projectsByCreation(recent: readonly RecentProject[]): RecentProject[] {
  return [...recent].sort((one, other) => {
    const when = byCodeUnit(listedAt(other), listedAt(one))
    return when === 0 ? byCodeUnit(one.path, other.path) : when
  })
}

/**
 * How many are kept. Long enough to hold a month of work, short enough that the shelf stays a
 * shortcut rather than a file manager.
 */
export const RECENT_PROJECTS_MAX = 12

/**
 * The folder the system's picker should open on, or nothing to let it reopen wherever it was
 * left.
 *
 * Letting it decide alone is what put the second project of a session INSIDE the first: the
 * dialog reopens where it last was, and after a creation that is the project's own folder.
 *
 * Derived rather than stored, from the shelf rather than from `lastProject` — the shelf survives
 * a folder being forgotten. The preference wins when it is set: it is the answer the user typed,
 * and an empty one means "follow me", which is precisely what the fallback does.
 */
export function projectPickerFolder(
  projectsFolder: string | undefined,
  recent: readonly RecentProject[],
): string | undefined {
  if (projectsFolder) return projectsFolder

  const [last] = projectsByCreation(recent)
  return last && parentFolder(last.path)
}

/**
 * The folder holding an absolute path, or nothing when there is no folder above it to name.
 *
 * Both separators, unlike `parentOf` in `domain/folder.ts`, which walks the `/`-joined ids the
 * explorer uses: this one reads paths the OS wrote, and a Windows project would otherwise answer
 * its own whole path.
 *
 * A project at a drive root answers nothing rather than `C:` — that is not a folder but a
 * drive-relative prefix, which the system resolves against a working directory nobody chose.
 */
function parentFolder(path: string): string | undefined {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (cut <= 0) return undefined

  const parent = path.slice(0, cut)
  return parent.endsWith(':') ? undefined : parent
}

/**
 * The list after a project has been opened: most recently opened first, one entry per path,
 * bounded. This is STORAGE order — what gets evicted — and not what any screen draws; see
 * `projectsByCreation`.
 *
 * Pure, and here rather than in the main process, because it is the whole of the policy — and
 * because "opening a project I already have must not list it twice" is the sort of rule that
 * only ever gets checked by a test.
 */
export function withRecentProject(
  recent: readonly RecentProject[],
  project: Project,
  openedAt: string,
): RecentProject[] {
  const entry: RecentProject = {
    path: project.path,
    name: project.manifest.name,
    openedAt,
    createdAt: project.manifest.createdAt,
  }

  return [entry, ...withoutRecentProject(recent, project.path)].slice(0, RECENT_PROJECTS_MAX)
}

/**
 * What opening a project asks of the account list.
 *
 * `adopt` and `missing` both end with the project pointed at whatever is active. They stay apart
 * because only one of them owes the user a sentence: a project that never had a key is not a
 * project whose key went away.
 */
export type ProjectAccountPlan =
  | { kind: 'keep' }
  | { kind: 'adopt' }
  | { kind: 'restore'; account: AccountSummary }
  | { kind: 'missing' }

/**
 * Which account a project should open on, given the accounts held.
 *
 * Here rather than in the main process, for the reason `withRecentProject` gives above: this is
 * the whole of the policy, and it is the sort of rule only a test ever checks.
 *
 * An absent link means "nothing said", never "no account" — removing a key and adding it back
 * mints a fresh id, so a live key can leave a link naming nothing.
 */
export function planProjectAccount(
  link: string | undefined,
  accounts: readonly AccountSummary[],
): ProjectAccountPlan {
  if (link === undefined) return { kind: 'adopt' }

  const held = accounts.find(account => account.id === link)
  if (!held) return { kind: 'missing' }

  return held.active ? { kind: 'keep' } : { kind: 'restore', account: held }
}

/**
 * The list with one entry wearing a new name, and nothing else touched — not its dates, and above
 * all not its ORDER: a rename is not an opening.
 *
 * The name is stored rather than derived from the folder, so renaming a project in its manifest and
 * leaving this list alone would go on listing it under the old one until it was next opened. The
 * two writes therefore belong together, which is why this sits beside the manifest's own constants
 * rather than inside whichever surface offered the rename.
 *
 * A path the list does not hold is not an error: the open project need not be a remembered one.
 */
export function renamedRecentProject(
  recent: readonly RecentProject[],
  path: string,
  name: string,
): RecentProject[] {
  return recent.map(entry => (entry.path === path ? { ...entry, name } : entry))
}

/**
 * The list without one folder — what a project moved or deleted since it was last opened comes
 * to. Beside the other half of the policy rather than written into whichever surface noticed:
 * an opening can fail anywhere, and a list that only forgets when the home clicked it is a list
 * that keeps offering a folder nothing can open.
 */
export function withoutRecentProject(
  recent: readonly RecentProject[],
  path: string,
): RecentProject[] {
  return recent.filter(candidate => candidate.path !== path)
}

/**
 * Subfolders created when a project is opened — see spec § 5. The asset folders are derived
 * from `ASSET_FOLDERS` rather than relisted, so adding a kind cannot leave the writer pointing
 * at a folder this never created.
 */
/**
 * Rebuildable cache, not user content: proxies, waveforms and filmstrips of ingested media.
 * Named rather than spelled out at each use — the folder the ingest writes into and the folder
 * the project creates have to be the same string.
 */
export const PROXIES_FOLDER = '.index/proxies'
export const PEAKS_FOLDER = '.index/peaks'
export const FILMSTRIPS_FOLDER = '.index/filmstrips'
/**
 * Stills for the assets that are not pictures: a mesh's, brought down with its bytes, and a
 * rush's — the library's when it came from there, one grabbed by ffmpeg when it came off a disk.
 */
export const POSTERS_FOLDER = '.index/posters'

export const PROJECT_FOLDERS: readonly string[] = [
  'assets',
  ...Object.values(ASSET_FOLDERS),
  DOCUMENTS_FOLDER,
  '.index',
  PROXIES_FOLDER,
  PEAKS_FOLDER,
  FILMSTRIPS_FOLDER,
  POSTERS_FOLDER,
]
