import type { ToolDefinition } from '@/features/shell/definition'
import { AssetBrowser } from '../components/Asset/Browser/AssetBrowser'
import { AssetBrowserActions } from '../components/Asset/Browser/AssetBrowserActions'

export const definition: ToolDefinition = {
  Content: AssetBrowser,
  Actions: AssetBrowserActions,
}
