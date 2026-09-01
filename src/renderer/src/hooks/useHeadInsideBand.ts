import { useEffect } from 'react'
import type { Us } from '@shared/domain/time'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

/**
 * Pulls the head back inside the band when the band is shortened under it.
 *
 * Nothing else would: shortening is an edit of the document, the head is session state, and the
 * two never meet. Left outside, the head sits where no key can stand, and Play stops on the frame
 * it starts on — the very defect the rewind was added to close.
 */
export function useHeadInsideBand(documentId: string, duration: Us): void {
  useEffect(() => {
    // The head is READ rather than subscribed to: only a shortened band can strand it, and every
    // writer of the head already clamps against the duration it had.
    if (sceneViewOf(useSceneViews.getState(), documentId).playhead <= duration) return
    useSceneViews.getState().setPlayhead(documentId, duration)
  }, [documentId, duration])
}
