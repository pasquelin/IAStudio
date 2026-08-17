import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { CloudAsset, CloudPage } from '@shared/domain/cloudAsset'

const NO_PAGE: CloudPage = { assets: [], cursor: null }

export type CloudPages = {
  /** Every page read so far, newest first, each asset once. */
  assets: readonly CloudAsset[]
  /** Nothing more to ask for — the listing ran out, or the API refused. */
  exhausted: boolean
  /** Still waiting on the first page: neither « empty » nor « finished ». */
  pending: boolean
  /** Asks for the next page. Safe to call again before it has answered. */
  more: () => void
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
    getNextPageParam: page => page.cursor ?? undefined,
    initialPageParam: undefined,
    enabled,
  })

  const assets = useMemo(() => onceEach(query.data?.pages), [query.data])

  // Destructured rather than closed over: the query is a fresh object every render, and a caller
  // handing `more` to an end-of-list effect would re-arm it on each one.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const more = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return { assets, exhausted: !hasNextPage, pending: query.isPending, more }
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
