import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLatest } from './useLatest'

/** One page of a listing walked by cursor. `cursor` is `null` once there is no page after it. */
export type Page<T> = {
  items: readonly T[]
  cursor: string | null
}

const NO_PAGE: Page<never> = { items: [], cursor: null }

/**
 * How many pages bringing nothing new are walked before the listing is called finished. A page or
 * two of pure duplicates is ordinary — the listing shifts under the offset — and each one costs a
 * search quota, so they are counted rather than tolerated.
 */
const BARREN_MAX = 3

export type PagesOptions = {
  /** A listing nobody is asking for reads nothing at all: every page costs a search quota. */
  enabled?: boolean
  /**
   * Read once and kept for as long as the key lives, instead of read again when the cache goes
   * stale. For a listing whose pages are billed and whose freshness nobody is waiting on.
   */
  once?: boolean
}

export type Pages<T> = {
  /** Every page read so far, in the order they came, each item once. */
  items: readonly T[]
  /** Nothing more to ask for — the listing ran out, or the API refused. */
  exhausted: boolean
  /** Still waiting on the first page: neither « empty » nor « finished ». */
  pending: boolean
  /** A page is on its way, the first one included. */
  fetching: boolean
  /** A page AFTER the first is on its way — what a list says at its foot. */
  fetchingMore: boolean
  /** How many pages have landed. It moves on an answer that brought nothing, which nothing else does. */
  pagesRead: number
  /**
   * What the API refused with, or `null`. A refusal and an end look alike on screen and must not
   * be said alike: one is worth trying again, the other is an answer.
   */
  refusal: unknown
  /** Asks for the next page. Safe to call again before it has answered. */
  more: () => void
  /** Reads it again from its first page — what a refusal is worth offering. */
  retry: () => void
}

/**
 * A listing accumulated page by page, keyed by what it is asking. Named for what a panel needs
 * rather than for what the query cache offers, so the paging policy — one page in flight, an id
 * seen once, a listing that stops when it stops advancing — is stated here instead of per panel.
 */
export function usePages<T extends { id: string }>(
  key: readonly unknown[],
  read: (from: { cursor?: string }) => Promise<Page<T>> | undefined,
  { enabled = true, once = false }: PagesOptions = {},
): Pages<T> {
  const query = useInfiniteQuery<Page<T>>({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      read(typeof pageParam === 'string' ? { cursor: pageParam } : {}) ?? Promise.resolve(NO_PAGE),
    getNextPageParam: (page, pages, asked) =>
      nextCursor(page, pages, typeof asked === 'string' ? asked : undefined),
    initialPageParam: undefined,
    enabled,
    ...(once ? { staleTime: Number.POSITIVE_INFINITY } : {}),
  })

  const items = useMemo(() => onceEach(query.data?.pages), [query.data])

  // Read through a ref rather than captured, so `more` never changes identity: a caller hands it
  // to an end-of-list effect, and one that re-arms on every fetch spends its budget on itself.
  const state = useLatest(query)
  // Marked here and not read off the query: a grid near its end asks on every frame, and three
  // calls in one batch all see the same render's `isFetchingNextPage`.
  const asking = useRef(false)
  const more = useCallback(() => {
    if (asking.current || !state.current.hasNextPage || state.current.isFetchingNextPage) return

    asking.current = true
    void state.current.fetchNextPage()
  }, [state])

  // Back to what the render says, after every one of them. Not the promise's own `finally`, which
  // runs after React has re-rendered on the page that landed — and after the effect that would
  // then have asked for the next one; and not on a change of that flag, which a fetch answering
  // inside one batch never shows.
  useEffect(() => {
    asking.current = query.isFetchingNextPage
  })
  const retry = useCallback(() => void state.current.refetch(), [state])

  return {
    items,
    // Never before the first page has answered: « nothing here » and « not read yet » look alike
    // on screen, and a band that said the first would announce an emptiness about to be denied.
    exhausted: !query.hasNextPage && !query.isPending,
    pending: query.isPending,
    fetching: query.isFetching,
    fetchingMore: query.isFetchingNextPage,
    pagesRead: query.data?.pages.length ?? 0,
    refusal: query.error,
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
function nextCursor<T extends { id: string }>(
  page: Page<T>,
  pages: readonly Page<T>[],
  asked: string | undefined,
): string | undefined {
  if (page.cursor === null || page.cursor === asked) return undefined

  return barrenTail(pages) >= BARREN_MAX ? undefined : page.cursor
}

/** How many pages, counting back from the last, brought nothing the ones before them held. */
function barrenTail<T extends { id: string }>(pages: readonly Page<T>[]): number {
  let barren = 0

  for (let index = pages.length - 1; index > 0; index -= 1) {
    const held = new Set(pages.slice(0, index).flatMap(page => page.items.map(item => item.id)))
    if (pages[index]?.items.some(item => !held.has(item.id))) break
    barren += 1
  }

  return barren
}

/**
 * The pages as one list, minus what a later page repeats: these listings page by OFFSET over
 * something that keeps growing, so an item created between two requests shifts everything down
 * one and the same row comes back — twice on screen, and twice under one React key.
 */
function onceEach<T extends { id: string }>(pages: readonly Page<T>[] | undefined): readonly T[] {
  const held = new Map<string, T>()

  for (const page of pages ?? []) {
    for (const item of page.items) if (!held.has(item.id)) held.set(item.id, item)
  }

  return [...held.values()]
}
