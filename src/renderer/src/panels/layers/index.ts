import type { ToolDefinition } from '@/panels/definition'
import { LayersActions } from './LayersActions'
import { LayersPanel } from './LayersPanel'

export const definition: ToolDefinition = { Content: LayersPanel, Actions: LayersActions }
