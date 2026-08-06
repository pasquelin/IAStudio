import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CANAUX, EVENEMENTS, type Desabonnement, type PontStudio } from '@shared/ipc'
import type { Projet } from '@shared/domain/projet'
import type { ProgressionTache } from '@shared/domain/tache'

function abonner<T>(canal: string, rappel: (charge: T) => void): Desabonnement {
  const ecouteur = (_evenement: IpcRendererEvent, charge: T): void => rappel(charge)
  ipcRenderer.on(canal, ecouteur)
  return () => {
    ipcRenderer.removeListener(canal, ecouteur)
  }
}

const pont: PontStudio = {
  reglages: {
    lire: () => ipcRenderer.invoke(CANAUX.reglagesLire),
    ecrire: partiels => ipcRenderer.invoke(CANAUX.reglagesEcrire, partiels),
    definirIdentifiants: (cle, secret) =>
      ipcRenderer.invoke(CANAUX.reglagesDefinirIdentifiants, cle, secret),
    etatAuthentification: () => ipcRenderer.invoke(CANAUX.reglagesEtatAuthentification),
    oublierIdentifiants: () => ipcRenderer.invoke(CANAUX.reglagesOublierIdentifiants),
  },
  scenario: {
    listerModeles: famille => ipcRenderer.invoke(CANAUX.scenarioListerModeles, famille),
    decrireModele: modeleId => ipcRenderer.invoke(CANAUX.scenarioDecrireModele, modeleId),
    generer: (modeleId, corps) => ipcRenderer.invoke(CANAUX.scenarioGenerer, modeleId, corps),
    annulerTache: tacheId => ipcRenderer.invoke(CANAUX.scenarioAnnulerTache, tacheId),
    listerTaches: () => ipcRenderer.invoke(CANAUX.scenarioListerTaches),
    surProgression: rappel => abonner<ProgressionTache>(EVENEMENTS.tacheProgression, rappel),
  },
  projet: {
    creer: (chemin, nom) => ipcRenderer.invoke(CANAUX.projetCreer, chemin, nom),
    ouvrir: chemin => ipcRenderer.invoke(CANAUX.projetOuvrir, chemin),
    courant: () => ipcRenderer.invoke(CANAUX.projetCourant),
    choisirDossier: () => ipcRenderer.invoke(CANAUX.projetChoisirDossier),
    surChangement: rappel => abonner<Projet | null>(EVENEMENTS.projetChange, rappel),
  },
  assets: {
    rechercher: requete => ipcRenderer.invoke(CANAUX.assetsRechercher, requete),
    url: assetId => ipcRenderer.invoke(CANAUX.assetsUrl, assetId),
  },
}

contextBridge.exposeInMainWorld('studio', pont)
