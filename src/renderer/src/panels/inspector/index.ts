import type { ToolDefinition } from '@/features/shell/definition'
import { Inspector } from './Inspector/Inspector'
import { InspectorActions } from './InspectorActions'

export const definition: ToolDefinition = { Content: Inspector, Actions: InspectorActions }
