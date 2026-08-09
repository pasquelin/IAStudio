import type { ToolDefinition } from '@/panels/definition'
import { Inspector } from './Inspector'
import { InspectorActions } from './InspectorActions'

export const definition: ToolDefinition = { Content: Inspector, Actions: InspectorActions }
