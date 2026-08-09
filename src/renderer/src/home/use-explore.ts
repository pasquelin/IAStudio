import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
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
}

const START: Feed = { assets: [], cursor: null, exhausted: false }

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

  // Emptied as the tab or the key changes, during the render rather than after it. What the feed
  // held was read under the previous one, and a tab that keeps the last one's pictures while it
  // loads is answering a question nobody asked.
  if (shown !== source) {
    setShown(source)
    setFeed(START)
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
        setFeed(held => ({
          assets: appended(held.assets, page.assets),
          cursor: page.cursor,
          exhausted: page.cursor === null,
        }))
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
