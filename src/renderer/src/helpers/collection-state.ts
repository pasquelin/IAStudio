/**
 * The state a browsable collection carries, and the pure operations over it. Kept apart from
 * the components so the panels that own this state — and drive a server query from it — can
 * be tested without rendering a virtualized grid.
 */
import { foldForSearch } from '@shared/text'
import { clamp } from '@shared/numeric'

export type CollectionView = 'grid' | 'list'

export type FacetOption = {
  value: string
  label: string
}

export type FacetDescriptor = {
  key: string
  label: string
  /**
   * Declared by the caller rather than derived from the items: a paginated collection only
   * ever holds the page it is showing, so values read off it would come and go while scrolling.
   */
  options: readonly FacetOption[]
}

export type CollectionState = {
  search: string
  view: CollectionView
  thumbnailSize: number
  sort: string | null
  /** Selected values per facet key; an absent or empty entry means the facet is off. */
  selections: Record<string, readonly string[]>
}

export const MIN_THUMBNAIL = 64
export const MAX_THUMBNAIL = 208
export const THUMBNAIL_STEP = 24

/**
 * Bumped whenever `CollectionState` changes shape, and shared by every store that persists
 * one: a restored state missing a field it now needs lays out a grid of zero-wide columns.
 */
export const COLLECTION_PERSIST_VERSION = 2

export const DEFAULT_COLLECTION_STATE: CollectionState = {
  search: '',
  view: 'grid',
  thumbnailSize: 112,
  sort: null,
  selections: {},
}

/** For panels with no grid and no filters: a fixed state, never persisted. */
export const LIST_ONLY: CollectionState = { ...DEFAULT_COLLECTION_STATE, view: 'list' }

export function resizeThumbnails(state: CollectionState, delta: number): CollectionState {
  const thumbnailSize = clamp(state.thumbnailSize + delta, MIN_THUMBNAIL, MAX_THUMBNAIL)
  return thumbnailSize === state.thumbnailSize ? state : { ...state, thumbnailSize }
}

export function selectedValues(state: CollectionState, key: string): readonly string[] {
  return state.selections[key] ?? []
}

/**
 * Sets a facet, or clears it when handed nothing. An emptied facet is dropped rather than
 * held as an empty list, which is what tells a narrowed collection from an untouched one.
 */
export function setFacetValue(
  state: CollectionState,
  key: string,
  value: string | null,
): CollectionState {
  const selections = { ...state.selections }
  if (value) selections[key] = [value]
  else delete selections[key]

  return { ...state, selections }
}

/**
 * Whether anything is narrowing the collection — which is what tells the two empty states apart.
 *
 * `offered` bounds the question to the facets this surface actually shows, and a panel whose
 * facets depend on where it is opened must pass them: a value the bar does not draw cannot be
 * relaxed by the user, so blaming an empty panel on it asks for a filter nobody can find.
 */
export function isFiltered(state: CollectionState, offered?: readonly string[]): boolean {
  if (state.search.trim().length > 0) return true

  return Object.entries(state.selections).some(
    ([key, values]) => values.length > 0 && (offered ? offered.includes(key) : true),
  )
}

export type LocalFilter<T> = {
  /** The text a search matches against. */
  text: (item: T) => string
  /** Values held by an item, per facet key. A facet with no reader here is left to the caller. */
  facets?: Record<string, (item: T) => readonly string[]>
}

/**
 * Applies the state to items already held in memory. Collections paginated by the API filter
 * server-side instead and never call this — which is why the components themselves filter
 * nothing: only the caller knows where its items come from.
 */
export function filterLocally<T>(
  items: readonly T[],
  state: CollectionState,
  filter: LocalFilter<T>,
): T[] {
  const needle = foldForSearch(state.search.trim())

  return items.filter(item => {
    if (needle && !foldForSearch(filter.text(item)).includes(needle)) return false

    for (const [key, values] of Object.entries(state.selections)) {
      const read = filter.facets?.[key]
      if (!read || values.length === 0) continue

      const held = new Set(read(item))
      if (!values.some(value => held.has(value))) return false
    }

    return true
  })
}
