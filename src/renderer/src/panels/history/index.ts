import type { ToolDefinition } from '@/panels/definition'
import { History } from './History'
import { HistoryActions } from './HistoryActions'

export const definition: ToolDefinition = { Content: History, Actions: HistoryActions }
