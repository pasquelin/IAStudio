import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_COLLECTION_STATE, setFacetValue } from '@/helpers/collection-state'
import { FAMILY_FACET } from '@/panels/models/family-facet'
import { ORIGIN_FACET } from '@/panels/models/model-filters'
import { useModels } from './models'

beforeEach(() => {
  useModels.setState({ selected: {}, preset: {}, prepared: null })
})

describe('choosing a model', () => {
  it('files it under the scope it was browsed in', () => {
    useModels.getState().select('image', 'model_flux', 'image')

    expect(useModels.getState().selected.image).toBe('model_flux')
  })

  /**
   * The graph browses every family at once, so its own scope is `'all'` — and a generator node
   * asks for "the video model", never for "the model". Filed under `'all'` alone, a choice made
   * in the graph was invisible to the very node that sent the user to make it.
   */
  it('files it under its own family as well, where the two differ', () => {
    useModels.getState().select('all', 'model_kling', 'video')

    expect(useModels.getState().selected.all).toBe('model_kling')
    expect(useModels.getState().selected.video).toBe('model_kling')
  })

  it('leaves the other families alone', () => {
    useModels.setState({ selected: { image: 'model_flux' } })

    useModels.getState().select('all', 'model_kling', 'video')

    expect(useModels.getState().selected.image).toBe('model_flux')
  })

  /**
   * The other side of the same coin, asserted rather than avoided: a choice is global to its
   * family, so picking an image model in the graph replaces the one Image was on. See `select`
   * for why the distinction is not recorded.
   */
  it('replaces the choice of the space that browses that family', () => {
    useModels.setState({ selected: { image: 'model_flux' } })

    useModels.getState().select('all', 'model_sdxl', 'image')

    expect(useModels.getState().selected.image).toBe('model_sdxl')
  })

  /**
   * Asserted on what actually lands on disk rather than on the shape handed to `partialize`:
   * this is the only place that says what a restart restores.
   */
  describe('what survives a restart', () => {
    const stored = (): { selections?: Record<string, readonly string[]> } => {
      const raw = localStorage.getItem('scenario-studio:models')
      return raw ? (JSON.parse(raw).state?.collection ?? {}) : {}
    }

    const narrowTo = (facet: string, value: string): void =>
      useModels.getState().setCollection(setFacetValue(DEFAULT_COLLECTION_STATE, facet, value))

    /**
     * Nobody types this one: a generator node with no model to build from writes it on its way
     * to opening the panel. Kept, it would reopen the graph on one family for good — the very
     * reason the typed search is dropped too.
     */
    it('drops a family narrowing that a node asked for rather than the user', () => {
      narrowTo(FAMILY_FACET, 'video')

      expect(stored().selections).toEqual({})
    })

    it('keeps the facets the user did set by hand', () => {
      narrowTo(ORIGIN_FACET, 'official')

      expect(stored().selections).toEqual({ [ORIGIN_FACET]: ['official'] })
    })
  })

  /** A choice made by hand closes the parenthesis an action opened — see `prepared`. */
  it('drops a preparation the user has just overruled', () => {
    useModels.setState({ prepared: 'upscale' })

    useModels.getState().select('all', 'model_kling', 'video')

    expect(useModels.getState().prepared).toBeNull()
  })
})
