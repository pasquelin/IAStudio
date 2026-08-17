import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAutomaticPulls } from './useAutomaticPulls'
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
 * search quota.
 */
const BARREN_MAX = 3

export type PagesOptions = {
  /** A listing nobody is asking for reads nothing at all: every page costs a search quota. */
  enabled?: boolean
  /**
   * Kept for as long as the key lives rather than read again once the cache goes stale — for a
   * listing whose pages are billed and whose freshness nobody is waiting on.
   */
  once?: boolean
  /**
   * Asks on its own while too little is drawn. A surface with no row has no end for a scroll to
   * near, and a page the API narrowed away draws nothing while having a next one behind it.
   */
  fill?: true | { wanted?: number; max?: number }
}

export type Pages<T> = {
  /** Every page read so far, in the order they came, each item once. */
  items: readonly T[]
  /** The very map `items` is built from, so looking one up stays a lookup. */
  byId: ReadonlyMap<string, T>
  /** Nothing more to ask for — the listing ran out, or the API refused. */
  exhausted: boolean
  /** Still waiting on the first page: neither « empty » nor « finished ». */
  pending: boolean
  /** A page is on its way, the first one included. */
  fetching: boolean
  /** A page AFTER the first is on its way — what a list says at its foot. */
  fetchingMore: boolean
  /** How many pages have landed. It moves on an answer that brought nothing; nothing else does. */
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
 * A listing accumulated page by page, keyed by what it is asking. The paging policy — one page in
 * flight, an id seen once, a listing that stops when its cursor does — is stated here rather than
 * once per panel.
 */
export function usePages<T extends { id: string }>(
  key: readonly unknown[],
  read: (from: { cursor?: string }) => Promise<Page<T>> | undefined,
  { enabled = true, once = false, fill }: PagesOptions = {},
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

  const byId = useMemo(() => onceEach(query.data?.pages), [query.data])
  const items = useMemo(() => [...byId.values()], [byId])

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

  // Released after every render, not by the promise's own `finally`: that one runs after React has
  // re-rendered on the page that landed, hence after the effect that would ask for the next.
  useEffect(() => {
    asking.current = query.isFetchingNextPage
  })

  // Never before the first page has answered: « nothing here » and « not read yet » look alike on
  // screen, and a band that said the first would announce an emptiness about to be denied.
  const exhausted = !query.hasNextPage && !query.isPending

  useAutomaticPulls({
    // The query's own key, so the count starts afresh exactly when the listing changes question.
    key: JSON.stringify(key),
    drawn: items.length,
    fetching: query.isFetching,
    answered: query.data?.pages.length ?? 0,
    ask: fill && enabled && !exhausted ? more : null,
    ...(fill === true ? {} : fill),
  })

  return {
    items,
    byId,
    exhausted,
    pending: query.isPending,
    fetching: query.isFetching,
    fetchingMore: query.isFetchingNextPage,
    pagesRead: query.data?.pages.length ?? 0,
    refusal: query.error,
    more,
    retry: useCallback(() => void state.current.refetch(), [state]),
  }
}

/**
 * Where the next page starts, or nothing when there is no next page. Two ways a listing ends
 * without saying so: the offset stops advancing at its ceiling and the API answers the same page
 * for ever, and a run of pages bringing nothing new is the same dead end one step slower.
 */
function nextCursor<T extends { id: string }>(
  page: Page<T>,
  pages: readonly Page<T>[],
  asked: string | undefined,
): string | undefined {
  if (page.cursor === null || page.cursor === asked) return undefined

  return barrenTail(pages) >= BARREN_MAX ? undefined : page.cursor
}

/**
 * How many pages, counting back from the last, brought nothing the ones before them held. One
 * forward walk: react-query asks this on every RENDER of the hook, not only on a fetch.
 */
function barrenTail<T extends { id: string }>(pages: readonly Page<T>[]): number {
  const held = new Set<string>()
  let barren = 0

  for (const [index, page] of pages.entries()) {
    const before = held.size
    for (const item of page.items) held.add(item.id)
    barren = index > 0 && held.size === before ? barren + 1 : 0
  }

  return barren
}

/**
 * The pages by id, minus what a later one repeats: these listings page by OFFSET over something
 * that keeps growing, so an item created between two requests shifts everything down one and the
 * same row comes back — twice on screen, and twice under one React key.
 */
function onceEach<T extends { id: string }>(pages: readonly Page<T>[] | undefined): Map<string, T> {
  const held = new Map<string, T>()

  for (const page of pages ?? []) {
    for (const item of page.items) if (!held.has(item.id)) held.set(item.id, item)
  }

  return held
}
