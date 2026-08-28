import { AssistantConversation } from '@/assistant/AssistantConversation/AssistantConversation'

/**
 * The assistant as a panel of the right column, where one talks to the studio while a document
 * is in front. The empty centre stages the same conversation, and the panel is withheld for as
 * long as it does.
 */
export function Assistant() {
  return <AssistantConversation />
}
