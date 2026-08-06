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

/** Sous-dossiers créés à l'ouverture d'un projet — cf. spec § 5. */
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
