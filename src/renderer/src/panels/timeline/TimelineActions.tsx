import { activeSceneId, activeSequenceId, useDocuments } from '@/stores/documents'
import { AnimationActions } from './AnimationActions'
import { SequenceActions } from './SequenceActions'

/**
 * What the timeline panel puts on its own title bar — the montage tools for a sequence, the
 * transport and the settings for a scene's animation.
 *
 * Split off from the panel so its hooks never run without a document, as the layer panel does.
 */
export function TimelineActions() {
  const sceneId = useDocuments(activeSceneId)
  const documentId = useDocuments(activeSequenceId)

  if (sceneId) return <AnimationActions documentId={sceneId} />
  if (!documentId) return null
  return <SequenceActions documentId={documentId} />
}
