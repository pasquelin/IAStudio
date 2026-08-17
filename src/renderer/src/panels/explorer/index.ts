import type { ToolDefinition } from '@/panels/definition'
import { Explorer } from './Explorer'
import { ExplorerActions } from './ExplorerActions'

export const definition: ToolDefinition = { Content: Explorer, Actions: ExplorerActions }
