import type { FC } from 'react'
import { ActionsAssetBrowser, AssetBrowser } from '@/panels/AssetBrowser'
import { Explorateur } from '@/panels/Explorateur'
import { Generateur } from '@/panels/Generateur'
import { Taches } from '@/panels/Taches'
import type { IdOutil } from './outils'

export type DefinitionOutil = {
  Contenu: FC
  /** Actions rendues dans la barre de titre, sur la même ligne que le nom du panneau. */
  Actions?: FC
}

/** Table des contenus d'outils, séparée du registre pour garder `outils.ts` sans dépendance UI. */
export const COMPOSANTS_OUTILS: Record<IdOutil, DefinitionOutil> = {
  explorateur: { Contenu: Explorateur },
  generateur: { Contenu: Generateur },
  assets: { Contenu: AssetBrowser, Actions: ActionsAssetBrowser },
  taches: { Contenu: Taches },
}
