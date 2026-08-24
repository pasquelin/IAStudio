import type { IWatermarkPanelProps } from 'dockview-react'
import { useTranslation } from 'react-i18next'
import { AssistantConversation } from '@/assistant/AssistantConversation/AssistantConversation'
import { useAssistantOffer } from '@/hooks/useAssistantOffer'
import { useAssistant } from '@/stores/assistant'
import { DocumentsMessage } from '../DocumentsMessage'

/**
 * What the middle of the window holds with no document open: Dockview's watermark, taken down on
 * the first group — so it costs nothing while a document is worked on. Same store as the modal,
 * so a sentence begun here is the one ⌘K opens onto.
 */
export function DocumentsIdle({ group }: IWatermarkPanelProps) {
  const { t } = useTranslation()
  const offer = useAssistantOffer()
  const overlayUp = useAssistant(state => state.open)

  // The modal is over this and carries the same thread. Rendered anyway, it would put a second
  // question with a second pair of buttons — and a second focusable field — behind the scrim.
  if (overlayUp) return null

  // Dockview mounts this factory twice over: once for the empty centre, and once per EMPTY GROUP,
  // which `group` is the only way to tell apart. Two of those would be two fields on one draft.
  // Not reachable through today's layout, and pinned here rather than left to stay that way.
  //
  // The other plain message is the manager not having answered yet, which is not the same as
  // nothing serving the assistant: a call to configure shown meanwhile blinks over a studio that
  // is perfectly well set up.
  if (group !== undefined || offer === 'unknown') {
    return <DocumentsMessage message={t('documents.none')} />
  }

  return (
    <div className="flex size-full flex-col">
      <AssistantConversation />
    </div>
  )
}
