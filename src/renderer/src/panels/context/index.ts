import type { ToolDefinition } from '@/panels/definition'
import { Context } from './Context'
import { ContextActions } from './ContextActions'

export const definition: ToolDefinition = { Content: Context, Actions: ContextActions }
