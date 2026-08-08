import { dragChannel } from './drag'

/** Dragging an asset out of the browser and onto an editor. See `dragChannel` for the why. */
export const ASSET_DRAG_TYPE = 'application/x-scenario-asset'

const ASSETS = dragChannel(ASSET_DRAG_TYPE)

export const startAssetDrag = ASSETS.start
export const assetIdFromDrag = ASSETS.idFrom
