export const MANIFEST_VERSION = 1

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
