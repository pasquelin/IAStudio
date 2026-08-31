import type { ToolDefinition } from '@/panels/definition'
import { LayersActions } from '../../features/image/components/Layers/LayersActions'
import { LayersPanel } from '../../features/image/components/Layers/LayersPanel'

export const definition: ToolDefinition = { Content: LayersPanel, Actions: LayersActions }
