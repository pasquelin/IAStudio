import type { ToolDefinition } from '@/features/shell/definition'
import { Context } from '../../features/context/components/Context/Context'
import { ContextActions } from '../../features/context/components/Context/ContextActions'

export const definition: ToolDefinition = { Content: Context, Actions: ContextActions }
