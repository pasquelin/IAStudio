import type { ToolDefinition } from '@/features/shell/definition'
import { History } from '../../features/git/components/History/History'
import { HistoryActions } from '../../features/git/components/History/HistoryActions'

export const definition: ToolDefinition = { Content: History, Actions: HistoryActions }
