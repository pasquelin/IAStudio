export type StatutTache = 'en-file' | 'en-cours' | 'reussi' | 'echoue' | 'annule'

/** Un job Scenario, vu par le studio. Le vocabulaire reste français côté domaine. */
export type Tache = {
  id: string
  modeleId: string
  libelle: string
  statut: StatutTache
  /** De 0 à 1. */
  progression: number
  creeLe: string
  termineLe?: string
  assetIds: string[]
  erreur?: string
}

export type ProgressionTache = Pick<Tache, 'id' | 'statut' | 'progression'> & {
  assetIds?: string[]
  erreur?: string
}

export const TACHE_TERMINEE: readonly StatutTache[] = ['reussi', 'echoue', 'annule']

export function estTerminee(statut: StatutTache): boolean {
  return TACHE_TERMINEE.includes(statut)
}
