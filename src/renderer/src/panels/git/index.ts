import type { ToolDefinition } from '@/panels/definition'
import { Git } from './Git'
import { GitActions } from './GitActions'

export const definition: ToolDefinition = { Content: Git, Actions: GitActions }
