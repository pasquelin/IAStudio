import type { ToolDefinition } from '@/features/shell/definition'
import { Context } from '../components/Context/Context'
import { ContextActions } from '../components/Context/ContextActions'

export const definition: ToolDefinition = { Content: Context, Actions: ContextActions }
