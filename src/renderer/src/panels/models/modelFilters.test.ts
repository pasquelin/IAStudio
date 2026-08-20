import { describe, expect, it } from 'vitest'
import { DEFAULT_COLLECTION_STATE, type CollectionState } from '@/helpers/collectionState'
import {
  CAPABILITY_FACET,
  facetsFor,
  ORIGIN_FACET,
  PERIOD_FACET,
  PUBLISHER_FACET,
  queryFrom,
  sortOptions,
  TAG_FACET,
} from './modelFilters'

const identity = (key: string): string => key

function stateWith(overrides: Partial<CollectionState>): CollectionState {
  return { ...DEFAULT_COLLECTION_STATE, ...overrides }
}

describe('model filters', () => {
  /**
   * Measured over the 642 public models: `class`, `performanceStats` and the author name come
   * back empty on every one. A category, author or rating facet would filter nothing at all.
   */
  it('offers only the facets the API can answer', () => {
    const keys = facetsFor('image', identity).map(facet => facet.key)

    expect(keys).toEqual([ORIGIN_FACET, CAPABILITY_FACET, TAG_FACET, PUBLISHER_FACET, PERIOD_FACET])
    // Category and collections are empty on all 642 public models, even through
    // `GET /models/{id}`; every public model shares one opaque `authorId`.
    expect(keys).not.toContain('category')
    expect(keys).not.toContain('collection')
  })

  it('offers the capabilities of the family at hand', () => {
    const capability = facetsFor('video', identity).find(facet => facet.key === CAPABILITY_FACET)

    expect(capability?.options.map(option => option.value)).toEqual([
      'txt2video',
      'img2video',
      'video2video',
    ])
  })

  // Families the API describes no capability or tag for must not show an empty menu.
  it('drops the facets the family has nothing for', () => {
    expect(facetsFor('other', identity).map(facet => facet.key)).toEqual([
      ORIGIN_FACET,
      PERIOD_FACET,
    ])
  })

  /**
   * Kling and Vidu publish video, Tripo publishes 3D. A flat list would offer, in the Image
   * workspace, a publisher whose only possible answer is "no result".
   */
  it('offers only the publishers of the family at hand', () => {
    const forImage = facetsFor('image', identity).find(facet => facet.key === PUBLISHER_FACET)
    const forVideo = facetsFor('video', identity).find(facet => facet.key === PUBLISHER_FACET)
    const values = (facet?: { options: readonly { value: string }[] }) =>
      facet?.options.map(option => option.value) ?? []

    expect(values(forVideo)).toContain('Kling')
    expect(values(forImage)).not.toContain('Kling')
    expect(values(forImage)).toContain('Black Forest Labs')
  })

  /**
   * This read `expect({ value: 'I2V', label: 'I2V' })` and called it "verbatim rather than
   * translated", on the grounds that translating a tag "would send a label that matches nothing".
   * It would not: `value` is what the API matches and `label` is what a person reads, and the
   * capability menu one push above had been splitting the two all along. What the tag menu
   * actually did was show `Text to Image` inside an otherwise French interface.
   */
  it('sends the tag the API matches, and shows the words a reader reads', () => {
    const tag = facetsFor('video', identity).find(facet => facet.key === TAG_FACET)

    expect(tag?.options).toContainEqual({ value: 'First Frame', label: 'modelTags.firstFrame' })
  })

  /**
   * An acronym reads the same in both languages, and a raw key reads like a bug. The value
   * standing in as its own label is what keeps a tag nobody named from ever showing one.
   */
  it('shows an unnamed tag as the publisher wrote it, never as a key', () => {
    const tag = facetsFor('video', identity).find(facet => facet.key === TAG_FACET)

    expect(tag?.options).toContainEqual({ value: 'I2V', label: 'I2V' })
  })

  /**
   * `image-upscale` was offered here while it named a family of its own: the listing had already
   * excluded every model the facet could match, so the menu's only possible answer was none.
   */
  it('offers no tag that names a family of its own', () => {
    const tag = facetsFor('image', identity).find(facet => facet.key === TAG_FACET)

    expect(tag?.options.map(option => option.value)).not.toContain('image-upscale')
  })

  it('sorts by the API score first, which is what popularity means here', () => {
    expect(sortOptions(identity)[0]?.value).toBe('relevance')
  })

  describe('query', () => {
    it('always narrows to the workspace family', () => {
      expect(queryFrom(DEFAULT_COLLECTION_STATE, '3d', '')).toMatchObject({ family: '3d' })
    })

    /**
     * Exact equality rather than an absence: a capability the bar kept from another space is
     * dropped, while origin and search, which every model carries, stay.
     */
    it('drops what the family at hand cannot answer, and keeps the rest', () => {
      const state = stateWith({
        selections: { [ORIGIN_FACET]: ['official'], [CAPABILITY_FACET]: ['txt2video'] },
      })

      expect(queryFrom(state, 'image', 'flux')).toEqual({
        family: 'image',
        sort: 'relevance',
        origin: 'official',
        search: 'flux',
      })
    })

    it('carries the chosen capability of the family at hand', () => {
      const state = stateWith({ selections: { [CAPABILITY_FACET]: ['img2video'] } })

      expect(queryFrom(state, 'video', '')).toMatchObject({
        family: 'video',
        capabilities: ['img2video'],
      })
    })

    it('leaves out a search that is only whitespace', () => {
      expect(queryFrom(DEFAULT_COLLECTION_STATE, 'image', '   ')).not.toHaveProperty('search')
    })

    it('trims the search rather than sending the spaces along', () => {
      expect(queryFrom(DEFAULT_COLLECTION_STATE, 'image', '  flux ')).toMatchObject({
        search: 'flux',
      })
    })

    it('carries the chosen origin and capabilities', () => {
      const state = stateWith({
        selections: { [ORIGIN_FACET]: ['official'], [CAPABILITY_FACET]: ['txt2img', 'inpaint'] },
      })

      expect(queryFrom(state, 'image', '')).toMatchObject({
        origin: 'official',
        capabilities: ['txt2img', 'inpaint'],
      })
    })

    // A persisted state could hold a value the facet no longer offers.
    it('ignores an origin it does not recognize', () => {
      const state = stateWith({ selections: { [ORIGIN_FACET]: ['whoever'] } })

      expect(queryFrom(state, 'image', '')).not.toHaveProperty('origin')
    })

    /**
     * The publisher IS a tag, so both facets have to reach the API through the one parameter
     * it offers — sending them apart would mean one of the two silently doing nothing.
     */
    it('sends the publisher alongside the tags, in one parameter', () => {
      const state = stateWith({
        selections: { [TAG_FACET]: ['I2V'], [PUBLISHER_FACET]: ['Kling'] },
      })

      expect(queryFrom(state, 'video', '').tags).toEqual(['I2V', 'Kling'])
    })

    /**
     * The bar's state is shared by every workspace: a capability picked under Image survives a
     * switch to 3D, where the menu no longer lists it and shows nothing selected. Sending it
     * anyway empties the panel with no visible cause.
     */
    it('drops a value the family at hand does not offer', () => {
      const state = stateWith({
        selections: { [CAPABILITY_FACET]: ['txt2img'], [PUBLISHER_FACET]: ['Kling'] },
      })

      const query = queryFrom(state, '3d', '')

      expect(query).not.toHaveProperty('capabilities')
      expect(query).not.toHaveProperty('tags')
    })

    it('carries the chosen tags and period', () => {
      const state = stateWith({
        selections: { [TAG_FACET]: ['I2V'], [PERIOD_FACET]: ['week'] },
      })

      expect(queryFrom(state, 'video', '')).toMatchObject({ tags: ['I2V'], since: 'week' })
    })

    // A persisted state can hold a span the facet no longer offers.
    it('ignores a period it does not recognize', () => {
      const state = stateWith({ selections: { [PERIOD_FACET]: ['fortnight'] } })

      expect(queryFrom(state, 'image', '')).not.toHaveProperty('since')
    })

    it('falls back to relevance for an unknown sort', () => {
      expect(queryFrom(stateWith({ sort: 'nonsense' }), 'image', '')).toMatchObject({
        sort: 'relevance',
      })
    })

    it('asks for the recent order when it is chosen', () => {
      expect(queryFrom(stateWith({ sort: 'recent' }), 'image', '')).toMatchObject({
        sort: 'recent',
      })
    })
  })
})
