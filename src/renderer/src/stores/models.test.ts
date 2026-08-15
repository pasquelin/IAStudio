import { beforeEach, describe, expect, it } from 'vitest'
import type { ModelFamily } from '@shared/domain/model'
import { DEFAULT_COLLECTION_STATE, setFacetValue } from '@/helpers/collection-state'
import { ORIGIN_FACET } from '@/panels/models/model-filters'
import { useModels } from './models'

beforeEach(() => {
  useModels.setState({ selected: {}, collections: {}, preset: {}, prepared: null })
})

describe('choosing a model', () => {
  it('files it under the family it belongs to', () => {
    useModels.getState().select('image', 'model_flux')

    expect(useModels.getState().selected.image).toBe('model_flux')
  })

  it('leaves the other families alone', () => {
    useModels.setState({ selected: { image: 'model_flux' } })

    useModels.getState().select('video', 'model_kling')

    expect(useModels.getState().selected.image).toBe('model_flux')
  })

  /**
   * A choice is global to its family, so picking an image model from anywhere replaces the one
   * Image was on. See `select` for why the distinction is not recorded.
   */
  it('replaces the choice already filed under that family', () => {
    useModels.setState({ selected: { image: 'model_flux' } })

    useModels.getState().select('image', 'model_sdxl')

    expect(useModels.getState().selected.image).toBe('model_sdxl')
  })

  /**
   * Asserted on what actually lands on disk rather than on the shape handed to `partialize`:
   * this is the only place that says what a restart restores.
   */
  describe('what survives a restart', () => {
    const stored = (family: ModelFamily): { selections?: Record<string, readonly string[]> } => {
      const raw = localStorage.getItem('scenario-studio:models')
      return raw ? (JSON.parse(raw).state?.collections?.[family] ?? {}) : {}
    }

    const narrowTo = (family: ModelFamily, facet: string, value: string): void =>
      useModels
        .getState()
        .setCollection(family, setFacetValue(DEFAULT_COLLECTION_STATE, facet, value))

    it('keeps the facets the user did set by hand', () => {
      narrowTo('image', ORIGIN_FACET, 'official')

      expect(stored('image').selections).toEqual({ [ORIGIN_FACET]: ['official'] })
    })

    /**
     * THE defect the split was made for. One state was shared by all seven spaces AND persisted,
     * so "Official" ticked under Image narrowed the Skyboxes space too — where, its models
     * carrying no `sc:scenario` tag, it matched nothing at all — and went on doing so across
     * restarts, in a space the user had never filtered and could not think to unfilter.
     */
    it('leaves the spaces the user did not filter alone', () => {
      narrowTo('image', ORIGIN_FACET, 'official')

      expect(stored('skybox').selections).toBeUndefined()
    })
  })

  /** A choice made by hand closes the parenthesis an action opened — see `prepared`. */
  it('drops a preparation the user has just overruled', () => {
    useModels.setState({ prepared: 'upscale' })

    useModels.getState().select('video', 'model_kling')

    expect(useModels.getState().prepared).toBeNull()
  })
})
