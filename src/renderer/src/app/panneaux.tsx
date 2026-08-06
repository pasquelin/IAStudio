import type { IDockviewPanelProps } from 'dockview-react'
import { AssetBrowser } from '@/panels/AssetBrowser'
import { Explorateur } from '@/panels/Explorateur'
import { Generateur } from '@/panels/Generateur'
import { Taches } from '@/panels/Taches'

export type IdPanneau = 'explorateur' | 'generateur' | 'assets' | 'taches'

export const PANNEAUX: readonly IdPanneau[] = ['explorateur', 'generateur', 'assets', 'taches']

/** Clé i18n du titre d'un panneau — le titre n'est jamais écrit en dur. */
export function cleTitrePanneau(id: string): string {
  return `panneaux.${id}`
}

/** Table des composants remise à Dockview. Les clés sont les `component` des panneaux. */
export const COMPOSANTS_PANNEAUX: Record<string, React.FC<IDockviewPanelProps>> = {
  explorateur: () => <Explorateur />,
  generateur: () => <Generateur />,
  assets: () => <AssetBrowser />,
  taches: () => <Taches />,
}
