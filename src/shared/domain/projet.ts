export const VERSION_MANIFESTE = 1

export type Manifeste = {
  version: number
  nom: string
  creeLe: string
  modifieLe: string
}

export type Projet = {
  chemin: string
  manifeste: Manifeste
}

/** Sous-dossiers créés à l'ouverture d'un projet — cf. spec § 5. */
export const DOSSIERS_PROJET: readonly string[] = [
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
