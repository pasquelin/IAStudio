import type { ToolDefinition } from '@/app/tool-components'
import { LayersActions } from './LayersActions'
import { LayersPanel } from './LayersPanel'

export const definition: ToolDefinition = { Content: LayersPanel, Actions: LayersActions }
