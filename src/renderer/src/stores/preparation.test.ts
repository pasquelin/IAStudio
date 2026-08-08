import { beforeEach, describe, expect, it } from 'vitest'
import { useLayouts } from './layouts'
import { useModels } from './models'
import { connectPreparation } from './preparation'

describe('a preparation', () => {
  beforeEach(() => {
    useModels.setState({ selected: {}, preset: {}, prepared: null })
    useLayouts.setState({ activeWorkspace: 'image' })
  })

  /**
   * Otherwise coming back into Image reopens the upscaler an edit asked for, while the Models
   * panel goes on showing the image model — two panels disagreeing about what Generate runs.
   */
  it('closes when the user leaves the space that made it', () => {
    const stop = connectPreparation()
    useModels.getState().prepare('upscale', 'model_big', { image: 'asset-flat' })

    useLayouts.setState({ activeWorkspace: 'video' })

    expect(useModels.getState().prepared).toBeNull()
    stop()
  })

  // The model and the values it was prepared with stay: only the detour ends.
  it('leaves the model it chose behind it', () => {
    const stop = connectPreparation()
    useModels.getState().prepare('upscale', 'model_big', { image: 'asset-flat' })

    useLayouts.setState({ activeWorkspace: 'video' })

    expect(useModels.getState().selected.upscale).toBe('model_big')
    expect(useModels.getState().preset.upscale).toEqual({ image: 'asset-flat' })
    stop()
  })

  it('survives a change that leaves the workspace alone', () => {
    const stop = connectPreparation()
    useModels.getState().prepare('upscale', 'model_big', {})

    useLayouts.setState({ layouts: {} })

    expect(useModels.getState().prepared).toBe('upscale')
    stop()
  })
})
