import type { CloudAssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { cloudPage } from '@/helpers/cloudPage'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { usePages, type Pages } from './usePages'

/** How much of the feed one request brings down. Enough to fill a tall window twice over. */
const PAGE_SIZE = 40

/**
 * One tab of the public feed, accumulated page by page.
 *
 * Read once and kept: six tabs re-reading their first page on every visit is a sweep of the row
 * costing eighteen `POST /search/assets`, the endpoint the catalogue bills apart. The tiles are
 * read through and never stored — they belong to other people, and their URLs expire.
 */
export function useExplore(type: CloudAssetType): Pages<CloudAsset> {
  const owner = useSettings(activeOwnerId)

  return usePages(
    ['explore', owner, type],
    from =>
      getBridge()
        ?.cloud.explore({ type, pageSize: PAGE_SIZE, ...from })
        .then(cloudPage),
    // Filled on its own: the main process narrows the hits again after the index answered, so a
    // whole page can be dropped — and the grid never asks for more on an empty grid.
    { once: true, fill: true },
  )
}
