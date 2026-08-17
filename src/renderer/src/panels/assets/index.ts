import type { ToolDefinition } from '@/panels/definition'
import { AssetBrowser } from './AssetBrowser'
import { AssetBrowserActions } from './AssetBrowserActions'

export const definition: ToolDefinition = {
  Content: AssetBrowser,
  Actions: AssetBrowserActions,
}
