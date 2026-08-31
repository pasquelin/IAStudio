import type { ToolDefinition } from '@/panels/definition'
import { Git } from '../../features/git/components/Git/Git'
import { GitActions } from '../../features/git/components/Git/GitActions'

export const definition: ToolDefinition = { Content: Git, Actions: GitActions }
