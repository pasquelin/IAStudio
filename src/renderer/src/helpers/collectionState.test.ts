import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COLLECTION_STATE,
  filterLocally,
  isFiltered,
  MAX_THUMBNAIL,
  MIN_THUMBNAIL,
  resizeThumbnails,
  selectedValues,
  setFacetValue,
} from './collectionState'

type Row = { id: string; name: string; capabilities: string[] }

const ROWS: Row[] = [
  { id: 'a', name: 'Flux Fast', capabilities: ['txt2img'] },
  { id: 'b', name: 'Veo Motion', capabilities: ['img2video'] },
  { id: 'c', name: 'Flux Detailed', capabilities: ['txt2img', 'img2video'] },
]

const FILTER = {
  text: (row: Row) => row.name,
  facets: { capability: (row: Row) => row.capabilities },
}

describe('collection state', () => {
  it('replaces the value a facet holds', () => {
    const official = setFacetValue(DEFAULT_COLLECTION_STATE, 'origin', 'official')
    const community = setFacetValue(official, 'origin', 'community')

    expect(selectedValues(community, 'origin')).toEqual(['community'])
  })

  // Held as an empty list, a cleared facet would keep reading as a narrowed collection.
  it('forgets a cleared facet instead of holding an empty entry', () => {
    const set = setFacetValue(DEFAULT_COLLECTION_STATE, 'capability', 'txt2img')
    const unset = setFacetValue(set, 'capability', null)

    expect(unset.selections).toEqual({})
    expect(isFiltered(unset)).toBe(false)
  })

  it('tells a narrowed collection from an untouched one', () => {
    expect(isFiltered(DEFAULT_COLLECTION_STATE)).toBe(false)
    expect(isFiltered({ ...DEFAULT_COLLECTION_STATE, search: '  ' })).toBe(false)
    expect(isFiltered({ ...DEFAULT_COLLECTION_STATE, search: 'flux' })).toBe(true)
  })

  it('bounds the thumbnail size at both ends', () => {
    const smallest = resizeThumbnails({ ...DEFAULT_COLLECTION_STATE, thumbnailSize: 70 }, -100)
    const largest = resizeThumbnails({ ...DEFAULT_COLLECTION_STATE, thumbnailSize: 200 }, 100)

    expect(smallest.thumbnailSize).toBe(MIN_THUMBNAIL)
    expect(largest.thumbnailSize).toBe(MAX_THUMBNAIL)
  })

  it('returns the same state when the size cannot move further', () => {
    const state = { ...DEFAULT_COLLECTION_STATE, thumbnailSize: MAX_THUMBNAIL }

    expect(resizeThumbnails(state, 24)).toBe(state)
  })
})

describe('local filtering', () => {
  it('matches the search against the text the caller declares', () => {
    const state = { ...DEFAULT_COLLECTION_STATE, search: 'flux' }

    expect(filterLocally(ROWS, state, FILTER).map(row => row.id)).toEqual(['a', 'c'])
  })

  it('ignores case and surrounding spaces', () => {
    const state = { ...DEFAULT_COLLECTION_STATE, search: '  VEO ' }

    expect(filterLocally(ROWS, state, FILTER).map(row => row.id)).toEqual(['b'])
  })

  /**
   * The same rule the settings search already follows: a box that demands a circumflex is a box
   * nobody uses. An asset named `Forêt d’hiver` has to answer to `foret`, which is what a hand
   * on a keyboard actually types when it is looking rather than spelling.
   */
  it('finds an accented name from an unaccented search, and the other way round', () => {
    const accented: Row[] = [
      { id: 'd', name: 'Forêt d’hiver', capabilities: [] },
      { id: 'e', name: 'Ete indien', capabilities: [] },
    ]

    const plain = { ...DEFAULT_COLLECTION_STATE, search: 'foret' }
    const marked = { ...DEFAULT_COLLECTION_STATE, search: 'été' }

    expect(filterLocally(accented, plain, FILTER).map(row => row.id)).toEqual(['d'])
    expect(filterLocally(accented, marked, FILTER).map(row => row.id)).toEqual(['e'])
  })

  // Values within one facet widen the result; that is what makes a facet a facet.
  it('keeps an item holding any of a facet’s selected values', () => {
    const state = {
      ...DEFAULT_COLLECTION_STATE,
      selections: { capability: ['txt2img', 'img2video'] },
    }

    expect(filterLocally(ROWS, state, FILTER)).toHaveLength(3)
  })

  it('combines the search with the facets', () => {
    const state = {
      ...DEFAULT_COLLECTION_STATE,
      search: 'flux',
      selections: { capability: ['img2video'] },
    }

    expect(filterLocally(ROWS, state, FILTER).map(row => row.id)).toEqual(['c'])
  })

  // A facet the caller filters server-side has no reader here, and must not silently empty
  // the collection.
  it('leaves a facet it cannot read alone', () => {
    const state = { ...DEFAULT_COLLECTION_STATE, selections: { origin: ['official'] } }

    expect(filterLocally(ROWS, state, FILTER)).toHaveLength(3)
  })
})
