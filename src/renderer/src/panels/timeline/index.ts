import type { ToolDefinition } from '@/app/tool-components'
import { TimelineActions, TimelinePanel } from './TimelinePanel'

export const definition: ToolDefinition = { Content: TimelinePanel, Actions: TimelineActions }
