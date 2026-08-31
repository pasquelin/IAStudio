import { AssistantConversation } from '@/features/assistant/components/Assistant/Conversation/AssistantConversation'
import type { ToolDefinition } from '@/panels/definition'
import { AssistantActions } from '../../features/assistant/components/Assistant/AssistantActions'

/**
 * The conversation, mounted straight as the panel's body: it fills what its host gives it, so the
 * host has nothing left to decide — a component in between would only rename it.
 */
export const definition: ToolDefinition = {
  Content: AssistantConversation,
  Actions: AssistantActions,
}
