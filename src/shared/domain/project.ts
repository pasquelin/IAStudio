import { ASSET_FOLDERS } from './asset'

export const MANIFEST_VERSION = 1

/** A project is a folder, not a binary file — versionable, inspectable, repairable by hand. */
export const PROJECT_EXTENSION = '.scenario'
export const MANIFEST_FILE = 'project.json'
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
  'documents',
  '.index',
  PROXIES_FOLDER,
  PEAKS_FOLDER,
  FILMSTRIPS_FOLDER,
  'layouts',
]
