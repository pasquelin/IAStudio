import type { ToolDefinition } from '@/app/tool-components'
import { AssetBrowser } from './AssetBrowser'
import { AssetBrowserActions } from './AssetBrowserActions'

export const definition: ToolDefinition = { Content: AssetBrowser, Actions: AssetBrowserActions }
