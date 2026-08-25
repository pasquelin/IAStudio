import { isPrivatePath } from '@shared/domain/folder'
import { exportContactSheet } from '@/app/contactSheetExport'
import { assetsAt } from '@/helpers/assetAt'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'

/** The three gestures that act on the CATALOGUE rows behind a selection of files. */
export type AssetAction = 'describe' | 'contactSheet' | 'push'

/**
 * Runs one of them over the paths selected in the explorer. The catalogue is asked once the
 * gesture is CHOSEN — a menu is drawn on a click and cannot wait on a round trip — and a path it
 * knows nothing about contributes no id, which is also how a folder is dropped.
 */
export async function runAssetAction(
  action: AssetAction,
  paths: readonly string[],
  contactSheetName: string,
): Promise<void> {
  // The same filter the menu counted on, so a greyed row and a gesture that does nothing cannot
  // disagree: what the studio keeps for itself has no catalogue row behind it.
  const held = await assetsAt(paths.filter(path => !isPrivatePath(path)))
  const chosen = [...held.values()]
  if (chosen.length === 0) return

  if (action === 'contactSheet') return void (await exportContactSheet(chosen, contactSheetName))

  const ids = chosen.map(asset => asset.id)
  if (action === 'push') return await useCloud.getState().push(ids)

  await getBridge()?.assets.describe(ids)
  // The names land in the catalogue, which the panels only re-read when asked.
  await useAssets.getState().refresh()
}
