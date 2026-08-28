import type { ToolDefinition } from '@/panels/definition'
import { Assistant } from './Assistant'
import { AssistantActions } from './AssistantActions'

export const definition: ToolDefinition = { Content: Assistant, Actions: AssistantActions }
