import type { ToolDefinition } from '@/panels/definition'
import { TimelineActions } from './TimelineActions'
import { TimelinePanel } from './TimelinePanel'

export const definition: ToolDefinition = { Content: TimelinePanel, Actions: TimelineActions }
