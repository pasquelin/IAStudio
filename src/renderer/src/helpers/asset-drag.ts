import { isAssetType, type Asset, type AssetType } from '@shared/domain/asset'
import { assetsById, useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { dragChannel } from './drag'

/** Dragging an asset out of the browser and onto an editor. See `dragChannel` for the why. */
export const ASSET_DRAG_TYPE = 'application/x-scenario-asset'

const ASSETS = dragChannel(ASSET_DRAG_TYPE)

/**
 * Announced when what is flying is a LIBRARY asset — one the catalogue does not hold yet.
 *
 * A type rather than a payload, for the same reason the kind is one: `getData` answers nothing
 * until the drop, so a target that needed to know during the drag could not ask. Nothing reads
 * it during `dragover` today — a library asset is accepted exactly like a local one, which is
 * the whole point — but the drop needs it to tell "not in the catalogue yet" from "gone".
 */
const LIBRARY_DRAG_TYPE = `${ASSET_DRAG_TYPE}+library`

const LIBRARY = dragChannel(LIBRARY_DRAG_TYPE)

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

  // Overridden after the channels, which default to `move` for the tabs and tree rows that
  // share them. Dropping an asset takes nothing away from the shelf it came from, and the
  // distinction is not academic: it is what puts the "+" under the pointer instead of the
  // arrow that means "this will be moved".
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

/**
 * The same drag, for an asset that is still only in the account's library.
 *
 * Deliberately announced under the SAME types a local one uses, kind included: a target decides
 * whether it welcomes a drop from what is flying, and a library mesh is a mesh. Only the extra
 * type tells the two apart, and only at the drop — where the difference is a download, not a
 * refusal.
 */
export function startLibraryDrag(
  event: { dataTransfer: DataTransfer | null },
  asset: { id: string; type: AssetType },
): void {
  // The marker FIRST, because every channel's `start` resets `effectAllowed` to `move` — and
  // `startAssetDrag` ends by overriding it to `copy`. Announced after, it undid that override,
  // and a `dropEffect` the allowed set forbids collapses the operation to `none`: the platform
  // then fires no `drop` at all. Every library drag landed nowhere, in silence.
  LIBRARY.start(event, asset.id)
  startAssetDrag(event, asset)
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
 * The dropped asset, resolved once here rather than by each surface that takes one — and
 * fetched first when what was dragged came from the library.
 *
 * Read from the catalogue at the drop rather than subscribed to: only the id crosses the drag,
 * and a surface that subscribed would re-render every time the catalogue refreshes.
 *
 * The whole difference between a local drop and a library one is the wait: a target accepts the
 * same kinds, lands the same `Asset` and knows nothing of where it came from. Refusing the drag
 * instead would have made the library half of the browser a shelf one can only look at.
 *
 * **Every read of the event happens before the first `await`**, and that is not a style choice:
 * a `DragEvent` is recycled once the handler returns, so `dataTransfer` is empty by the time a
 * promise settles. Callers must therefore call this synchronously from `onDrop`, which is why it
 * takes the event rather than an id.
 */
export async function droppedAsset(event: {
  dataTransfer: DataTransfer | null
}): Promise<Asset | null> {
  const id = assetIdFromDrag(event)
  const fromLibrary = LIBRARY.carries(event)
  if (!id) return null

  const held = assetsById(useAssets.getState()).get(id) ?? null
  if (held || !fromLibrary) return held

  return await useCloud.getState().fetchOne(id)
}
