import { mdiFormatText } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { layerById } from '@/engines/canvas/canvasState'
import { activeImageId, useDocuments } from '@/stores/documents'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { TextCharacterSection } from './TextCharacterSection'
import { TextParagraphSection } from './TextParagraphSection'

/**
 * How the armed caption is SET — the panel a type tool needs open while it types, which is why
 * it stands beside the layer stack rather than inside the inspector: an inspector folded away
 * takes the whole of it with it.
 *
 * A tool window has no props, so it follows the image in front and the layer armed in it.
 */
export function TextPanel() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeImageId)
  const canvas = useCanvases(state => (documentId ? canvasOf(state, documentId) : null))
  const armed = canvas ? layerById(canvas, canvas.activeLayerId) : null

  if (!documentId || armed?.kind !== 'text') {
    return <EmptyState icon={mdiFormatText} message={t('text.noCaption')} />
  }

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <TextCharacterSection documentId={documentId} layer={armed} />
      <TextParagraphSection documentId={documentId} layer={armed} />
    </div>
  )
}
