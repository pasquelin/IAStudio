import type { FC } from 'react'
import { AssetBrowser } from '@/panels/AssetBrowser'
import { Explorateur } from '@/panels/Explorateur'
import { Generateur } from '@/panels/Generateur'
import { Taches } from '@/panels/Taches'
import type { IdOutil } from './outils'

/** Table des contenus de fenêtres d'outils, séparée du registre pour garder `outils.ts` sans JSX. */
export const COMPOSANTS_OUTILS: Record<IdOutil, FC> = {
  explorateur: Explorateur,
  generateur: Generateur,
  assets: AssetBrowser,
  taches: Taches,
}
