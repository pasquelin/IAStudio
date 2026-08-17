import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { CloudAsset, CloudPage } from '@shared/domain/cloudAsset'
import { useLatest } from './useLatest'

const NO_PAGE: CloudPage = { assets: [], cursor: null }

/**
 * How many pages bringing nothing new are walked before the listing is called finished. A page or
 * two of pure duplicates is ordinary — the listing shifts under the offset — and each one costs a
 * search quota, so they are counted rather than tolerated.
 */
const BARREN_MAX = 3

export type CloudPages = {
  /** Every page read so far, newest first, each asset once. */
  assets: readonly CloudAsset[]
  /** Nothing more to ask for — the listing ran out, or the API refused. */
  exhausted: boolean
  /** Still waiting on the first page: neither « empty » nor « finished ». */
  pending: boolean
  /**
   * Stopped because the API refused rather than because the listing ran out. The two look alike on
   * screen and must not be said alike: one is worth trying again, the other is an answer.
   */
  refused: boolean
  /** Asks for the next page. Safe to call again before it has answered. */
  more: () => void
  /** Reads it again from its first page — what a refusal is worth offering. */
  retry: () => void
}

/**
 * A cloud listing accumulated page by page, keyed by what it is asking. Named for what a shelf
 * needs rather than for what the query cache offers, so the paging policy — one page in flight,
 * an id seen once — is stated here instead of once per panel.
 */
export function useCloudPages(
  key: readonly unknown[],
  read: (from: { cursor?: string }) => Promise<CloudPage> | undefined,
  enabled = true,
): CloudPages {
  const query = useInfiniteQuery<CloudPage>({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      read(typeof pageParam === 'string' ? { cursor: pageParam } : {}) ?? Promise.resolve(NO_PAGE),
    getNextPageParam: (page, pages, asked) =>
      nextCursor(page, pages, typeof asked === 'string' ? asked : undefined),
    initialPageParam: undefined,
    enabled,
  })

  const assets = useMemo(() => onceEach(query.data?.pages), [query.data])

  /**
   * Read through a ref rather than captured, so `more` never changes identity: a caller hands it
   * to an end-of-list effect, and one that re-arms on every fetch spends its budget on itself.
   */
  const state = useLatest(query)
  const more = useCallback(() => {
    if (state.current.hasNextPage && !state.current.isFetchingNextPage) {
      void state.current.fetchNextPage()
    }
  }, [state])
  const retry = useCallback(() => void state.current.refetch(), [state])

  return {
    assets,
    exhausted: !query.hasNextPage,
    pending: query.isPending,
    refused: query.isError,
    more,
    retry,
  }
}

/**
 * Where the next page starts, or nothing when there is no next page.
 *
 * Two ways a listing ends without saying so, and neither is an edge: the offset stops advancing at
 * its ceiling, and the API then answers the same page for ever — asking again is guaranteed to
 * bring what is already held. And a run of pages bringing nothing new is the same dead end, one
 * step slower.
 */
function nextCursor(
  page: CloudPage,
  pages: readonly CloudPage[],
  asked: string | undefined,
): string | undefined {
  if (page.cursor === null || page.cursor === asked) return undefined

  return barrenTail(pages) >= BARREN_MAX ? undefined : page.cursor
}

/** How many pages, counting back from the last, brought nothing the ones before them held. */
function barrenTail(pages: readonly CloudPage[]): number {
  let barren = 0

  for (let index = pages.length - 1; index > 0; index -= 1) {
    const held = new Set(pages.slice(0, index).flatMap(page => page.assets.map(asset => asset.id)))
    if (pages[index]?.assets.some(asset => !held.has(asset.id))) break
    barren += 1
  }

  return barren
}

/**
 * The pages as one list, minus what a later page repeats: these listings page by OFFSET over
 * something that keeps growing, so an asset created between two requests shifts everything down
 * one and the same tile comes back — twice on screen, and twice under one React key.
 */
function onceEach(pages: readonly CloudPage[] | undefined): readonly CloudAsset[] {
  const held = new Map<string, CloudAsset>()

  for (const page of pages ?? []) {
    for (const asset of page.assets) if (!held.has(asset.id)) held.set(asset.id, asset)
  }

  return [...held.values()]
}
