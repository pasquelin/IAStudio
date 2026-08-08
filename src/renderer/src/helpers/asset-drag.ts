import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import { dragChannel } from './drag'

/** Dragging an asset out of the browser and onto an editor. See `dragChannel` for the why. */
export const ASSET_DRAG_TYPE = 'application/x-scenario-asset'

const ASSETS = dragChannel(ASSET_DRAG_TYPE)

/**
 * The same drag, announced again under a type that names the kind being carried.
 *
 * The platform makes this necessary: during `dragover`, `dataTransfer.getData()` answers an
 * empty string — only `types` is readable before the drop itself. A target therefore cannot ask
 * WHICH asset is passing over it, only whether one is. Putting the kind in the MIME type is the
 * one place a target can read it in time to say whether it would accept the drop, which is what
 * lets a texture slot refuse a video while it is still flying.
 */
const BY_TYPE: Record<AssetType, ReturnType<typeof dragChannel>> = {
  image: dragChannel(`${ASSET_DRAG_TYPE}+image`),
  video: dragChannel(`${ASSET_DRAG_TYPE}+video`),
  audio: dragChannel(`${ASSET_DRAG_TYPE}+audio`),
  mesh: dragChannel(`${ASSET_DRAG_TYPE}+mesh`),
  texture: dragChannel(`${ASSET_DRAG_TYPE}+texture`),
  skybox: dragChannel(`${ASSET_DRAG_TYPE}+skybox`),
}

/** Announces the drag under both types: the plain one for existing targets, the typed one too. */
export function startAssetDrag(
  event: { dataTransfer: DataTransfer | null },
  asset: {
    id: string
    type: AssetType
  },
): void {
  ASSETS.start(event, asset.id)
  BY_TYPE[asset.type].start(event, asset.id)
}

export const assetIdFromDrag = ASSETS.idFrom

/** Whether an asset of ours is flying over, whatever its kind. */
export const carriesAsset = ASSETS.carries

/**
 * The kind being dragged, readable DURING the drag — which the identifier is not.
 *
 * `null` when the drag is not one of ours, or comes from a build that announced only the plain
 * type. A target that gets `null` should fall back to accepting, not to refusing: a drop that
 * silently does nothing is worse than one that lands somewhere sensible.
 */
export function draggedAssetType(event: { dataTransfer: DataTransfer | null }): AssetType | null {
  return ASSET_TYPES.find(type => BY_TYPE[type].carries(event)) ?? null
}
