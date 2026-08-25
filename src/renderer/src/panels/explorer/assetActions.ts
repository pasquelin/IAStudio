import { exportContactSheet } from '@/app/contactSheetExport'
import { assetsAt } from '@/helpers/assetAt'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'

/** The three gestures that act on the CATALOGUE rows behind a selection of files. */
export type AssetAction = 'describe' | 'contactSheet' | 'push'

/**
 * Runs one of them over the paths currently selected in the explorer.
 *
 * The conversion is here and not in the menu, and it is the whole reason this module exists: a
 * menu is drawn on a click and cannot wait on a round trip, so the paths travel as they are and
 * the catalogue is asked once the gesture has been chosen. A path the catalogue knows nothing
 * about simply contributes no id — which is also how a folder in the selection is dropped.
 */
export async function runAssetAction(
  action: AssetAction,
  paths: readonly string[],
  contactSheetName: string,
): Promise<void> {
  const held = await assetsAt(paths)
  const ids = [...held.values()].map(asset => asset.id)
  if (ids.length === 0) return

  if (action === 'contactSheet') return void (await exportContactSheet(ids, contactSheetName))
  if (action === 'push') return await useCloud.getState().push(ids)

  await getBridge()?.assets.describe(ids)
  // The names land in the catalogue, which the panels only re-read when asked.
  await useAssets.getState().refresh()
}
