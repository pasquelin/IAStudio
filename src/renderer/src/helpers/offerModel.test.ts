import { beforeEach, describe, expect, it } from 'vitest'
import { arrangedFor } from '@/stores/tool-fixtures'
import { arrangementOf, useTools } from '@/stores/tools'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { installFakeBridge } from '@/services/fakeBridge'
import { offerModelsOfFamily } from './offerModel'

let opened: string[] = []

beforeEach(() => {
  opened = []
  installFakeBridge({ settings: { open: section => (opened.push(section), Promise.resolve()) } })
  useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'image', home: false })
  useModels.setState({ collections: {}, selected: {} })
})

/**
 * What an image edit does where no model of its family has ever been chosen: it takes the user
 * to where one IS chosen. A failure message would say what went wrong and not what to do.
 */
describe('offering a model of one family', () => {
  it('opens the generation panel, whose picker lists exactly that family', () => {
    offerModelsOfFamily('image')

    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('generator')
  })

  /**
   * The browser lists that space's family and no other, so an upscaler would never appear in it
   * however long one looked. The settings are where those three families are set.
   */
  it('opens the settings for a family that space cannot list', () => {
    offerModelsOfFamily('upscale')

    expect(opened).toEqual(['ai.upscale'])
    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBeUndefined()
  })

  /** The home browses no catalogue at all, so it lands in the preferences like any other miss. */
  it('opens the settings from the home, which lists nothing', () => {
    useLayouts.setState({ home: true })

    offerModelsOfFamily('image')

    expect(opened).toEqual(['ai.image'])
  })
})
