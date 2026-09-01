import type { ToolDefinition } from '@/features/shell/definition'
import { LayersActions } from '../components/Layers/LayersActions'
import { LayersPanel } from '../components/Layers/LayersPanel'

export const definition: ToolDefinition = { Content: LayersPanel, Actions: LayersActions }
