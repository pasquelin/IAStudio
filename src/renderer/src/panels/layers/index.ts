import type { ToolDefinition } from '@/app/tool-components'
import { LayersActions, LayersPanel } from './LayersPanel'

export const definition: ToolDefinition = { Content: LayersPanel, Actions: LayersActions }
