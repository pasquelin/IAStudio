import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_COLLECTION_STATE, selectedValues } from '@/helpers/collection-state'
import { FAMILY_FACET } from '@/panels/models/family-facet'
import { arrangedFor } from '@/stores/tool-fixtures'
import { arrangementOf, useTools } from '@/stores/tools'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { installFakeBridge } from '@/services/fake-bridge'
import { offerModelsOfFamily } from './offer-model'

let opened: string[] = []

beforeEach(() => {
  opened = []
  installFakeBridge({ settings: { open: section => (opened.push(section), Promise.resolve()) } })
  useTools.setState({ arrangements: arrangedFor('graph', { open: {} }), focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'graph', home: false })
  useModels.setState({ collection: DEFAULT_COLLECTION_STATE, selected: {} })
})

/**
 * What a generator node does where no model of its family has ever been chosen: it takes the
 * user to where one IS chosen. A failure message would say what went wrong and not what to do.
 */
describe('offering a model of one family', () => {
  describe('where the space browses every family', () => {
    it('opens the browser in the column this space puts it in', () => {
      offerModelsOfFamily('video')

      expect(arrangementOf(useTools.getState(), 'graph').open.left?.primary).toBe('models')
    })

    it('narrows the catalogue to the family that was asked for', () => {
      offerModelsOfFamily('video')

      expect(selectedValues(useModels.getState().collection, FAMILY_FACET)).toEqual(['video'])
    })

    /** Asking for another family replaces the narrowing rather than adding to it. */
    it('replaces the family it was narrowed to before', () => {
      offerModelsOfFamily('video')
      offerModelsOfFamily('audio')

      expect(selectedValues(useModels.getState().collection, FAMILY_FACET)).toEqual(['audio'])
    })
  })

  describe('where the space browses one family of its own', () => {
    beforeEach(() => {
      useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
      useLayouts.setState({ activeWorkspace: 'image', home: false })
    })

    it('opens the browser for the family that space already lists', () => {
      offerModelsOfFamily('image')

      expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('models')
    })

    /**
     * The browser lists that space's family and no other, so an upscaler would never appear in
     * it however long one looked. The preferences are where those three families are set.
     */
    it('opens the preferences for a family that space cannot list', () => {
      offerModelsOfFamily('upscale')

      expect(opened).toEqual(['generation.upscale'])
      expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBeUndefined()
    })

    /**
     * The facet is not offered where the space has a family, so writing one would leave a filter
     * the user can neither see nor release — and it would follow them into the graph.
     */
    it('narrows nothing it could not show', () => {
      offerModelsOfFamily('upscale')

      expect(selectedValues(useModels.getState().collection, FAMILY_FACET)).toEqual([])
    })
  })
})
