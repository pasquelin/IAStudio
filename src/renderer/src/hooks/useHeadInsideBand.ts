import { useEffect } from 'react'
import type { Us } from '@shared/domain/time'
import { useSceneViews } from '@/stores/sceneViews'

/**
 * Pulls the head back inside the band when the band is shortened under it.
 *
 * Nothing else would: shortening is an edit of the document, the head is session state, and the
 * two never meet. Left outside, the head sits where no key can stand, and Play stops on the frame
 * it starts on — the very defect the rewind was added to close.
 */
export function useHeadInsideBand(documentId: string, playhead: Us, duration: Us): void {
  useEffect(() => {
    if (playhead <= duration) return
    useSceneViews.getState().setPlayhead(documentId, duration)
  }, [documentId, playhead, duration])
}
