import type { ToolDefinition } from '@/features/shell/definition'
import { Explorer } from '../../features/explorer/components/Explorer/Explorer'
import { ExplorerActions } from '../../features/explorer/components/Explorer/ExplorerActions'

export const definition: ToolDefinition = { Content: Explorer, Actions: ExplorerActions }
