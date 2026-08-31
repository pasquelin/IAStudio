import type { ToolDefinition } from '@/features/shell/definition'
import { Git } from '../components/Git/Git'
import { GitActions } from '../components/Git/GitActions'

export const definition: ToolDefinition = { Content: Git, Actions: GitActions }
