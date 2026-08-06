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

/** Subfolders created when a project is opened — see spec § 5. */
export const PROJECT_FOLDERS: readonly string[] = [
  'assets',
  'assets/img',
  'assets/3d',
  'assets/tex',
  'assets/vid',
  'assets/aud',
  'assets/sky',
  'documents',
  '.index',
  'layouts',
]
