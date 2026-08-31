import type { ToolDefinition } from '@/features/shell/definition'
import { Inspector } from '../../features/inspector/components/Inspector/Inspector'
import { InspectorActions } from '../../features/inspector/components/Inspector/InspectorActions'

export const definition: ToolDefinition = { Content: Inspector, Actions: InspectorActions }
