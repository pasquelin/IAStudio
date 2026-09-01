import type { ToolDefinition } from '@/features/shell/definition'
import { Inspector } from '../../inspector/components/Inspector/Inspector'
import { InspectorActions } from '../../inspector/components/Inspector/InspectorActions'

export const definition: ToolDefinition = { Content: Inspector, Actions: InspectorActions }
