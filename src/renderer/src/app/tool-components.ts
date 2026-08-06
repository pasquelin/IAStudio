import type { FC } from 'react'
import { AssetBrowser, AssetBrowserActions } from '@/panels/AssetBrowser'
import { Explorer } from '@/panels/Explorer'
import { Generator } from '@/panels/Generator'
import { Jobs } from '@/panels/Jobs'
import type { ToolId } from './tools'

export type ToolDefinition = {
  Content: FC
  /** Actions rendered in the title bar, on the same line as the panel name. */
  Actions?: FC
}

/** Tool content table, kept apart from the registry so `tools.ts` stays free of UI imports. */
export const TOOL_COMPONENTS: Record<ToolId, ToolDefinition> = {
  explorer: { Content: Explorer },
  generator: { Content: Generator },
  assets: { Content: AssetBrowser, Actions: AssetBrowserActions },
  jobs: { Content: Jobs },
}
