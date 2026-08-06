import { REGLAGES_PAR_DEFAUT, type Reglages, type ReglagesPartiels } from '@shared/domain/reglages'

export type Identifiants = {
  cle: string
  secret: string
}

/**
 * Ce dont le store a besoin pour persister. Injecté pour que les tests n'aient ni Electron
 * ni disque : `safeStorage` n'existe pas hors d'une application empaquetée.
 */
export type AdaptateurPersistance = {
  lire: <T>(cle: string) => T | undefined
  ecrire: (cle: string, valeur: unknown) => void
  supprimer: (cle: string) => void
  chiffrer: (clair: string) => string
  dechiffrer: (chiffre: string) => string
}

export type StoreReglages = {
  lire: () => Reglages
  ecrire: (partiels: ReglagesPartiels) => Reglages
  definirIdentifiants: (identifiants: Identifiants) => void
  oublierIdentifiants: () => void
  aDesIdentifiants: () => boolean
  /** Réservé au main. Ne jamais exposer par IPC — cf. spec § 4, invariant 1. */
  lireIdentifiants: () => Identifiants | null
}

const CLE_REGLAGES = 'reglages'
const CLE_IDENTIFIANTS = 'identifiants'

function fusionner(base: Reglages, partiels: ReglagesPartiels): Reglages {
  return {
    apparence: { ...base.apparence, ...partiels.apparence },
    generation: { ...base.generation, ...partiels.generation },
    stockage: { ...base.stockage, ...partiels.stockage },
  }
}

export function creerStoreReglages(adaptateur: AdaptateurPersistance): StoreReglages {
  const lire = (): Reglages => {
    const stockes = adaptateur.lire<ReglagesPartiels>(CLE_REGLAGES)
    return stockes ? fusionner(REGLAGES_PAR_DEFAUT, stockes) : REGLAGES_PAR_DEFAUT
  }

  const lireIdentifiants = (): Identifiants | null => {
    const chiffre = adaptateur.lire<string>(CLE_IDENTIFIANTS)
    if (!chiffre) return null
    try {
      const clair: unknown = JSON.parse(adaptateur.dechiffrer(chiffre))
      if (
        typeof clair === 'object' &&
        clair !== null &&
        'cle' in clair &&
        'secret' in clair &&
        typeof clair.cle === 'string' &&
        typeof clair.secret === 'string'
      ) {
        return { cle: clair.cle, secret: clair.secret }
      }
      return null
    } catch {
      // Trousseau changé, profil migré, données corrompues : on oublie plutôt que de
      // planter au démarrage. L'utilisateur ressaisira ses identifiants.
      adaptateur.supprimer(CLE_IDENTIFIANTS)
      return null
    }
  }

  return {
    lire,

    ecrire: partiels => {
      const fusionnes = fusionner(lire(), partiels)
      adaptateur.ecrire(CLE_REGLAGES, fusionnes)
      return fusionnes
    },

    definirIdentifiants: identifiants => {
      adaptateur.ecrire(CLE_IDENTIFIANTS, adaptateur.chiffrer(JSON.stringify(identifiants)))
    },

    oublierIdentifiants: () => adaptateur.supprimer(CLE_IDENTIFIANTS),

    aDesIdentifiants: () => lireIdentifiants() !== null,

    lireIdentifiants,
  }
}
