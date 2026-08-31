import type { ToolDefinition } from '@/features/shell/definition'
import { Explorer } from '../components/Explorer/Explorer'
import { ExplorerActions } from '../components/Explorer/ExplorerActions'

export const definition: ToolDefinition = { Content: Explorer, Actions: ExplorerActions }
