import { gridOf } from '@/engines/canvas/pixelGrid'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { activeImageId, useDocuments } from '@/stores/documents'

/**
 * What the image in front measures in cells — `null` when no image is there, or it is not on a
 * grid. The reactive half of `gridInFront`, which reads the same two stores at call time.
 */
export function usePixelArtGrid(): { columns: number; rows: number } | null {
  const documentId = useDocuments(activeImageId)
  return useCanvases(state => (documentId === null ? null : gridOf(canvasOf(state, documentId))))
}
