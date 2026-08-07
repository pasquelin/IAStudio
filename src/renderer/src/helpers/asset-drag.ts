/**
 * Dragging an asset out of the browser and onto an editor. A private MIME type rather than
 * `text/plain`: a file dragged in from the desktop must not look like one of ours.
 */
export const ASSET_DRAG_TYPE = 'application/x-scenario-asset'

type DragLike = { dataTransfer: DataTransfer | null }

export function startAssetDrag(event: DragLike, assetId: string): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(ASSET_DRAG_TYPE, assetId)
  event.dataTransfer.effectAllowed = 'copy'
}

export function assetIdFromDrag(event: DragLike): string | null {
  const assetId = event.dataTransfer?.getData(ASSET_DRAG_TYPE)
  return assetId ? assetId : null
}
