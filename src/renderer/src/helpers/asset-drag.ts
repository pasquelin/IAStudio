import { isAssetType, type Asset, type AssetType } from '@shared/domain/asset'
import { assetsById, useAssets } from '@/stores/assets'
import { dragChannel } from './drag'

/** Dragging an asset out of the browser and onto an editor. See `dragChannel` for the why. */
export const ASSET_DRAG_TYPE = 'application/x-scenario-asset'

const ASSETS = dragChannel(ASSET_DRAG_TYPE)

/**
 * The same drag, announced again under a type that names the kind being carried.
 *
 * Putting the kind in the MIME type is the one place a target can read it in time to say whether
 * it would accept the drop — `getData` answers nothing until the drop itself.
 */
const TYPED_PREFIX = `${ASSET_DRAG_TYPE}+`

/** Announces the drag under both types: the plain one for existing targets, the typed one too. */
export function startAssetDrag(
  event: { dataTransfer: DataTransfer | null },
  asset: {
    id: string
    type: AssetType
  },
): void {
  ASSETS.start(event, asset.id)
  dragChannel(`${TYPED_PREFIX}${asset.type}`).start(event, asset.id)
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
  // One read of `types`: it is a fresh array on every access, and this runs on every `dragover`.
  const announced = event.dataTransfer?.types.find(type => type.startsWith(TYPED_PREFIX))
  if (!announced) return null

  const kind = announced.slice(TYPED_PREFIX.length)
  return isAssetType(kind) ? kind : null
}

/**
 * The asset being dropped, resolved once here rather than by each surface that takes one.
 *
 * Read from the catalogue at the drop rather than subscribed to: only the id crosses the drag,
 * and a surface that subscribed would re-render every time the catalogue refreshes.
 */
export function draggedAsset(event: { dataTransfer: DataTransfer | null }): Asset | null {
  const id = assetIdFromDrag(event)
  if (!id) return null

  return assetsById(useAssets.getState()).get(id) ?? null
}
