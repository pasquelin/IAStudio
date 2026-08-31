import type { ToolDefinition } from '@/features/shell/definition'
import { AssetBrowser } from '../../features/assets/components/Asset/Browser/AssetBrowser'
import { AssetBrowserActions } from '../../features/assets/components/Asset/Browser/AssetBrowserActions'

export const definition: ToolDefinition = {
  Content: AssetBrowser,
  Actions: AssetBrowserActions,
}
