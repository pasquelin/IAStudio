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
 */
export function projectsByCreation(recent: readonly RecentProject[]): RecentProject[] {
  return [...recent].sort((one, other) => {
    const when = listedAt(other).localeCompare(listedAt(one))
    return when === 0 ? one.path.localeCompare(other.path) : when
  })
}

/**
 * How many are kept. Long enough to hold a month of work, short enough that the shelf stays a
 * shortcut rather than a file manager.
 */
export const RECENT_PROJECTS_MAX = 12

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

export const PROJECT_FOLDERS: readonly string[] = [
  'assets',
  ...Object.values(ASSET_FOLDERS),
  DOCUMENTS_FOLDER,
  '.index',
  PROXIES_FOLDER,
  PEAKS_FOLDER,
  FILMSTRIPS_FOLDER,
]
