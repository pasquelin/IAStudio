import type { FC } from 'react'
import { AssetBrowser, AssetBrowserActions } from '@/panels/AssetBrowser'
import { Explorer } from '@/panels/Explorer'
import { Generator } from '@/panels/Generator'
import { Jobs } from '@/panels/Jobs'
import type { ToolId } from './tools'

export type ToolDefinition = {
  Content: FC
  /** Actions rendues dans la barre de titre, sur la même ligne que le nom du panneau. */
  Actions?: FC
}

/** Table des contenus d'outils, séparée du registre pour garder `tools.ts` sans dépendance UI. */
export const TOOL_COMPONENTS: Record<ToolId, ToolDefinition> = {
  explorer: { Content: Explorer },
  generator: { Content: Generator },
  assets: { Content: AssetBrowser, Actions: AssetBrowserActions },
  jobs: { Content: Jobs },
}
