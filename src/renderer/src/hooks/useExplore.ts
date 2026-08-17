import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { cloudPage } from '@/helpers/cloudPage'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { useAutomaticPulls } from './useAutomaticPulls'
import { usePages } from './usePages'

/** How much of the feed one request brings down. Enough to fill a tall window twice over. */
const PAGE_SIZE = 40

/**
 * How many pages the tab walks on its own before it waits for a scroll. The main process narrows
 * the hits again after the index answered, so a whole page can be dropped — and the grid never
 * asks for more on an empty grid, which would leave a live feed reading « nothing published ».
 */
const AUTOMATIC_PULLS = 3

export type Explore = {
  assets: readonly CloudAsset[]
  /**
   * Nothing more to ask for: the feed ran out, or the first page was refused. Until it is true
   * there are pages behind what is on screen — which is what tells "not read yet" from "nothing
   * here".
   */
  exhausted: boolean
  /** Asks for the next page. Tolerates being called again before it has answered. */
  more: () => void
}

/**
 * One tab of the public feed, accumulated page by page.
 *
 * The tiles are read through and never stored. They belong to other people, and the URL that
 * draws one is signed and expires.
 */
export function useExplore(type: AssetType): Explore {
  const owner = useSettings(activeOwnerId)

  /**
   * Read once and kept for as long as the key lives. Six tabs re-reading their first page on
   * every visit is a sweep of the row costing eighteen `POST /search/assets` — the endpoint the
   * catalogue bills apart and reserves for the debounced path.
   */
  const feed = usePages(
    ['explore', owner, type],
    from =>
      getBridge()
        ?.cloud.explore({ type, pageSize: PAGE_SIZE, ...from })
        .then(cloudPage),
    { once: true },
  )

  useAutomaticPulls({
    key: `${owner} ${type}`,
    drawn: feed.items.length,
    max: AUTOMATIC_PULLS,
    fetching: feed.fetching,
    answered: feed.pagesRead,
    ask: feed.exhausted ? null : feed.more,
  })

  return { assets: feed.items, exhausted: feed.exhausted, more: feed.more }
}
