import { aiRoleId } from '@shared/domain/aiRole'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGeneration } from './generation'
import { useLayouts } from './layouts'
import { useModels } from './models'
import { connectPreparation } from './preparation'

const UPSCALE = aiRoleId('upscale', 'upscale')

describe('a preparation', () => {
  beforeEach(() => {
    useModels.setState({ selected: {}, preset: {} })
    useGeneration.setState({ forcedCapability: null })
    useLayouts.setState({ activeWorkspace: 'image' })
  })

  /**
   * Otherwise coming back into Image reopens the upscaler an edit asked for, in a space nobody
   * asked it of — an operation on screen with nothing left to explain it.
   */
  it('closes when the user leaves the space that made it', () => {
    const stop = connectPreparation()
    useGeneration.getState().forceCapability(UPSCALE)

    useLayouts.setState({ activeWorkspace: 'video' })

    expect(useGeneration.getState().forcedCapability).toBeNull()
    stop()
  })

  // The model and the values it was prepared with stay: only the detour ends.
  it('leaves the model it chose behind it', () => {
    const stop = connectPreparation()
    useModels.getState().prepare(UPSCALE, 'model_big', { image: 'asset-flat' })
    useGeneration.getState().forceCapability(UPSCALE)

    useLayouts.setState({ activeWorkspace: 'video' })

    expect(useModels.getState().selected[UPSCALE]).toBe('model_big')
    expect(useModels.getState().preset[UPSCALE]).toEqual({ image: 'asset-flat' })
    stop()
  })

  it('survives a change that leaves the workspace alone', () => {
    const stop = connectPreparation()
    useGeneration.getState().forceCapability(UPSCALE)

    useLayouts.setState({ layout: null })

    expect(useGeneration.getState().forcedCapability).toBe(UPSCALE)
    stop()
  })
})
