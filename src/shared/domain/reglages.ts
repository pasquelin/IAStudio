export type Theme = 'sombre' | 'clair'
export type Densite = 'compact' | 'confort'
export type BackendAssets = 'local' | 'cloud'

/**
 * Réglages lisibles par le renderer. Les identifiants API n'y figurent JAMAIS : le
 * renderer demande s'il est authentifié, pas quelle est la clé — cf. spec § 9.
 */
export type Reglages = {
  apparence: {
    theme: Theme
    densite: Densite
  }
  generation: {
    tachesSimultanees: number
    tentativesMax: number
  }
  stockage: {
    backend: BackendAssets
    dossierProjets?: string
    dernierProjet?: string
  }
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  apparence: { theme: 'sombre', densite: 'confort' },
  generation: { tachesSimultanees: 3, tentativesMax: 4 },
  stockage: { backend: 'local' },
}

export type ReglagesPartiels = {
  apparence?: Partial<Reglages['apparence']>
  generation?: Partial<Reglages['generation']>
  stockage?: Partial<Reglages['stockage']>
}

export type EtatAuthentification = { authentifie: true } | { authentifie: false; raison?: string }
