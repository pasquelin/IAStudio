import type { ToolDefinition } from '@/features/shell/definition'
import { History } from '../components/History/History'
import { HistoryActions } from '../components/History/HistoryActions'

export const definition: ToolDefinition = { Content: History, Actions: HistoryActions }
