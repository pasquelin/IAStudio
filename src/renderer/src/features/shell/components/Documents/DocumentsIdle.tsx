import type { IWatermarkPanelProps } from 'dockview-react'
import { useTranslation } from 'react-i18next'
import { AssistantConversation } from '@/features/assistant/components/Assistant/Conversation/AssistantConversation'
import { useAssistantOffer } from '@/hooks/useAssistantOffer'
import { DocumentsMessage } from './DocumentsMessage'

/**
 * What the middle of the window holds with no document open: Dockview's watermark, taken down on
 * the first group — so it costs nothing while a document is worked on. The right column's own
 * panel is withheld for as long as this stands, so there is one thread and one field on screen.
 */
export function DocumentsIdle({ group }: IWatermarkPanelProps) {
  const { t } = useTranslation()
  const offer = useAssistantOffer()

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

  // The reading frame is the HOST's: the conversation fills what it is given, and the centre is
  // the whole window — a line of text run across it is a line nobody reads twice. The panel does
  // the same in its own way, by being a column.
  return (
    <div className="mx-auto flex size-full max-w-(--sc-chat-width) flex-col">
      <AssistantConversation />
    </div>
  )
}
