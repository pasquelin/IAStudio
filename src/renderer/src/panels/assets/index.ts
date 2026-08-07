import type { ToolDefinition } from '@/app/tool-components'
import { AssetBrowser } from './AssetBrowser'
import { AssetBrowserActions } from './AssetBrowserActions'

// The shelf is the one panel that hands its whole filter bar to the title row in a band.
export const definition: ToolDefinition = {
  Content: AssetBrowser,
  Actions: AssetBrowserActions,
  fillActions: true,
}
