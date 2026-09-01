import { useEffect } from 'react'
import { canvasHost } from '@/features/image/canvasHosts'
import { useCanvases } from '@/stores/canvases'
import { useLivePreviews } from '@/stores/livePreviews'

/**
 * Long enough that a stroke publishes once when it ends rather than at every point of it, short
 * enough that letting go of the pointer and looking at the model reads as one gesture.
 */
const SETTLE_MS = 150

/**
 * Publishes what this editor is drawing, so every slot pointing at the asset it edits follows it
 * before anything is saved.
 *
 * On the SETTLING of a gesture, never during it: extracting the picture is 0.3 ms but uploading it
 * into the two other WebGL contexts is not free, and a stroke makes a hundred state changes.
 *
 * Revoked when the tab goes, which is what keeps « what I see » from outliving the editor showing
 * it — a preview is a state of the window, and nothing else in the studio may come to depend on
 * one (`livePreviews`).
 */
export function useLivePreview(documentId: string, sourceAssetId: string | undefined): void {
  useEffect(() => {
    if (!sourceAssetId) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const settle = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void (async () => {
          const drawn = await canvasHost(documentId)?.flattenBitmap()
          if (drawn) useLivePreviews.getState().publishPreview(sourceAssetId, drawn)
        })()
      }, SETTLE_MS)
    }

    const stop = useCanvases.subscribe((state, before) => {
      if (state.states[documentId] !== before.states[documentId]) settle()
    })

    return () => {
      if (timer) clearTimeout(timer)
      stop()
      useLivePreviews.getState().revokePreview(sourceAssetId)
    }
  }, [documentId, sourceAssetId])
}
