import type { Asset, RequeteAssets } from './domain/asset'
import type { DescripteurModele, FamilleModele, ResumeModele } from './domain/modele'
import type { Projet } from './domain/projet'
import type { EtatAuthentification, Reglages, ReglagesPartiels } from './domain/reglages'
import type { EtatFenetre } from './domain/fenetre'
import type { ProgressionTache, Tache } from './domain/tache'

/**
 * Source unique des noms de canaux. Seul `src/preload/` les cite : un composant qui
 * écrirait `ipcRenderer.invoke('...')` contournerait le contrat — cf. spec § 4.
 */
export const CANAUX = {
  reglagesLire: 'reglages:lire',
  reglagesEcrire: 'reglages:ecrire',
  reglagesDefinirIdentifiants: 'reglages:definir-identifiants',
  reglagesEtatAuthentification: 'reglages:etat-authentification',
  reglagesOublierIdentifiants: 'reglages:oublier-identifiants',

  scenarioListerModeles: 'scenario:lister-modeles',
  scenarioDecrireModele: 'scenario:decrire-modele',
  scenarioGenerer: 'scenario:generer',
  scenarioAnnulerTache: 'scenario:annuler-tache',
  scenarioListerTaches: 'scenario:lister-taches',

  projetCreer: 'projet:creer',
  projetOuvrir: 'projet:ouvrir',
  projetCourant: 'projet:courant',
  projetChoisirDossier: 'projet:choisir-dossier',

  assetsRechercher: 'assets:rechercher',
  assetsUrl: 'assets:url',

  fenetreFermer: 'fenetre:fermer',
  fenetreReduire: 'fenetre:reduire',
  fenetreZoomer: 'fenetre:zoomer',
  fenetrePleinEcran: 'fenetre:plein-ecran',
  fenetreEtat: 'fenetre:etat',
}

/** Canaux poussés par le main vers le renderer. */
export const EVENEMENTS = {
  tacheProgression: 'evt:tache-progression',
  projetChange: 'evt:projet-change',
  ouvrirOutil: 'evt:ouvrir-outil',
  commandeMenu: 'evt:commande-menu',
  fenetreEtat: 'evt:fenetre-etat',
}

export type Desabonnement = () => void

/** Demande d'ouverture d'un outil venue du menu natif. */
export type DemandeOutil = {
  zone: string
  outil: string
}

/** Commandes du menu natif sans charge utile, identifiées par un verbe. */
export type CommandeMenu = 'projet:nouveau' | 'projet:ouvrir' | 'disposition:reinitialiser'

/**
 * Ce que `window.studio` expose. Chaque méthode a exactement un canal dans `CANAUX`.
 */
export type PontStudio = {
  reglages: {
    lire: () => Promise<Reglages>
    ecrire: (partiels: ReglagesPartiels) => Promise<Reglages>
    definirIdentifiants: (cle: string, secret: string) => Promise<EtatAuthentification>
    etatAuthentification: () => Promise<EtatAuthentification>
    oublierIdentifiants: () => Promise<void>
  }
  scenario: {
    listerModeles: (famille?: FamilleModele) => Promise<ResumeModele[]>
    decrireModele: (modeleId: string) => Promise<DescripteurModele>
    generer: (modeleId: string, corps: Record<string, unknown>) => Promise<Tache>
    annulerTache: (tacheId: string) => Promise<void>
    listerTaches: () => Promise<Tache[]>
    surProgression: (rappel: (progression: ProgressionTache) => void) => Desabonnement
  }
  projet: {
    creer: (chemin: string, nom: string) => Promise<Projet>
    ouvrir: (chemin: string) => Promise<Projet>
    courant: () => Promise<Projet | null>
    choisirDossier: () => Promise<string | null>
    surChangement: (rappel: (projet: Projet | null) => void) => Desabonnement
  }
  assets: {
    rechercher: (requete: RequeteAssets) => Promise<Asset[]>
    url: (assetId: string) => Promise<string | null>
  }
  menu: {
    surOuvrirOutil: (rappel: (demande: DemandeOutil) => void) => Desabonnement
    surCommande: (rappel: (commande: CommandeMenu) => void) => Desabonnement
  }
  fenetre: {
    fermer: () => Promise<void>
    reduire: () => Promise<void>
    zoomer: () => Promise<void>
    basculerPleinEcran: () => Promise<void>
    etat: () => Promise<EtatFenetre>
    surEtat: (rappel: (etat: EtatFenetre) => void) => Desabonnement
  }
}
