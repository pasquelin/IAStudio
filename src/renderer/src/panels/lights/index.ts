import type { ToolDefinition } from '@/app/tool-components'
import { LightsActions, LightsPanel } from './LightsPanel'

export const definition: ToolDefinition = { Content: LightsPanel, Actions: LightsActions }
