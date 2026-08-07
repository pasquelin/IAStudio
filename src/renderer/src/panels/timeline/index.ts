import type { ToolDefinition } from '@/app/tool-components'
import { TimelineActions } from './TimelineActions'
import { TimelinePanel } from './TimelinePanel'

export const definition: ToolDefinition = { Content: TimelinePanel, Actions: TimelineActions }
