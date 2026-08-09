import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset, CloudPage } from '@shared/domain/cloud-asset'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'

/** How much of the feed one request brings down. Enough to fill a tall window twice over. */
const PAGE_SIZE = 40

export type Explore = {
  assets: readonly CloudAsset[]
  /**
   * Nothing more to ask for: the feed ran out, or the API refused. Until it is true there are
   * pages behind what is on screen — which is what tells "not read yet" from "nothing here".
   */
  exhausted: boolean
  /** Asks for the next page. Tolerates being called again before it has answered. */
  more: () => void
}

type Feed = {
  assets: readonly CloudAsset[]
  cursor: string | null
  exhausted: boolean
  /**
   * Pages in a row that brought nothing this feed did not already hold. Counted because
   * `appended` drops the duplicates silently, and nobody downstream can tell a page that added
   * forty tiles from one that added none.
   */
  barren: number
}

const START: Feed = { assets: [], cursor: null, exhausted: false, barren: 0 }

/**
 * How many barren pages are walked before the feed is called finished.
 *
 * A bound on a real runaway: at the foot of the feed the grid stays near its end, `more` takes a
 * new identity with every cursor, and the effect fires again — thirty requests without a gesture,
 * measured. Offset paging over a feed with deletions produces exactly that. A page or two of pure
 * duplicates is ordinary though (the feed shifts under the offset), so this is not one.
 */
const BARREN_MAX = 3

/**
 * The pages so far, plus what just arrived, minus what was already there.
 *
 * The index pages by offset over a feed that keeps growing: an asset published between two
 * requests shifts everything down one, and the same tile comes back on the next page. Without
 * this, scrolling a busy feed slowly fills it with duplicates — and React with duplicate keys.
 */
function appended(
  held: readonly CloudAsset[],
  arriving: readonly CloudAsset[],
): readonly CloudAsset[] {
  const seen = new Set(held.map(asset => asset.id))
  return [...held, ...arriving.filter(asset => !seen.has(asset.id))]
}

/**
 * The feed after a page landed on it.
 *
 * Two symmetric ways a feed with no new assets goes wrong, and both are settled here. Asking
 * again for a cursor that came back unchanged is guaranteed to return the same page, so one is
 * enough to know: `more`'s dependencies would not move either, the effect would never fire
 * again, and the tab would stop for good with nothing on it. A cursor that DOES advance while
 * bringing nothing new is only suspicious, so it is counted instead.
 */
function grown(held: Feed, page: CloudPage): Feed {
  const assets = appended(held.assets, page.assets)
  const barren = assets.length > held.assets.length ? 0 : held.barren + 1
  const repeats = page.cursor !== null && page.cursor === held.cursor

  return {
    assets,
    cursor: page.cursor,
    barren,
    exhausted: page.cursor === null || repeats || barren >= BARREN_MAX,
  }
}

/**
 * One tab of the public feed, accumulated page by page.
 *
 * Deliberately not `useShelf`, which reads once and replaces what it holds: this one appends,
 * carries a cursor, and is driven by the grid reaching its end. The shelf's policy on failure is
 * kept though — a refusal empties nothing and reports no error, it stops the feed and leaves
 * what was already published on screen.
 *
 * The tiles are read through and never stored. They belong to other people, and the URL that
 * draws one is signed and expires.
 */
export function useExplore(type: AssetType): Explore {
  const owner = useSettings(activeOwnerId)
  const source = `${owner}/${type}`

  const [feed, setFeed] = useState<Feed>(START)
  const [shown, setShown] = useState(source)

  /**
   * The tabs already read, so walking across them costs nothing twice.
   *
   * Six tabs, each re-reading its first page on every visit, and the main process spending up to
   * three searches to fill one of them: a sweep of the row could cost eighteen `POST
   * /search/assets` — the endpoint the catalogue bills apart and reserves for the debounced path.
   *
   * Held per mounted hook and not per module: the home is torn down when a workspace takes over,
   * so coming back is still a genuine refresh. Only the tab strip is made free.
   */
  const remembered = useRef(new Map<string, Feed>())

  // Swapped as the tab or the key changes, during the render rather than after it. What the feed
  // held was read under the previous one, and a tab that keeps the last one's pictures while it
  // loads is answering a question nobody asked.
  if (shown !== source) {
    // Compared against what WAS shown, never against the source being built from this very
    // `owner`: that test is true by construction, and the tabs of a revoked key would be kept.
    if (shown.startsWith(`${owner}/`)) remembered.current.set(shown, feed)
    else remembered.current.clear()

    setShown(source)
    setFeed(remembered.current.get(source) ?? START)
  }

  /**
   * Which request an answer belongs to, counted rather than named.
   *
   * The source alone cannot tell two requests apart, and leaving a tab and coming back makes
   * exactly that pair: the first request answers under the same `owner/type` as the third, so it
   * was accepted — merging a page from deep in the feed into a freshly reset one, overwriting
   * the cursor with a further one (every page in between then unreachable), and, when the stale
   * page happened to be the last, marking a two-tile band exhausted for good.
   */
  const ticket = useRef(0)
  /** One request at a time: the grid asks again on every frame it is near the end. */
  const busy = useRef(false)

  const more = useCallback(() => {
    if (busy.current || feed.exhausted) return

    const bridge = getBridge()
    // No bridge is an answer, and a final one: without it there is nothing left to ask.
    if (!bridge) return setFeed(current => ({ ...current, exhausted: true }))

    busy.current = true
    const mine = (ticket.current += 1)

    /** Whether this answer is still the one being waited on — and if so, it frees the lock. */
    const settle = (): boolean => {
      // Never by a twin: releasing the lock for a request still in flight is how two of them
      // end up running at once.
      if (ticket.current !== mine) return false
      busy.current = false
      return true
    }

    void bridge.cloud
      .explore({ type, pageSize: PAGE_SIZE, ...(feed.cursor ? { cursor: feed.cursor } : {}) })
      .then(page => {
        if (!settle()) return
        setFeed(held => grown(held, page))
      })
      .catch(() => {
        if (!settle()) return
        setFeed(held => ({ ...held, exhausted: true }))
      })

    return undefined
  }, [type, feed.cursor, feed.exhausted])

  useEffect(() => {
    // Declared before the one below, so the first page of the new source is asked for under a
    // ticket that no answer already in flight can carry.
    ticket.current += 1
    busy.current = false
  }, [source])

  /**
   * Keeps pulling while nothing is on screen and the feed has not run out.
   *
   * This is both the first read and the repair for an empty page. The main process narrows the
   * hits again after the index answered, so a whole page can be dropped — and the grid never
   * asks for more on an empty grid, quite rightly. Left there, a dropped page reads as the end
   * of the feed and the tab dies on "nothing published" with pages still to come.
   *
   * It terminates: the offset strictly advances, so the feed reaches its end and `exhausted`
   * stops the loop. Once anything is on screen, the grid drives the paging again.
   */
  useEffect(() => {
    if (!busy.current && feed.assets.length === 0 && !feed.exhausted) more()
  }, [feed.assets.length, feed.exhausted, more])

  return { assets: feed.assets, exhausted: feed.exhausted, more }
}
