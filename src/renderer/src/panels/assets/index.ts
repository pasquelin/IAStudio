import type { ToolDefinition } from '@/app/tool-components'
import { AssetBrowser, AssetBrowserActions } from './AssetBrowser'

export const definition: ToolDefinition = { Content: AssetBrowser, Actions: AssetBrowserActions }
