import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { ModelFamily } from '@shared/domain/model'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { hasModelFor, useAvailableTools } from './tool-registry'

function preferModel(family: ModelFamily, modelId: string): void {
  useSettings.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      generation: { ...DEFAULT_SETTINGS.generation, defaultModels: { [family]: modelId } },
    },
  })
}

function idsOf(zone: 'right', workspace: 'image' | 'textures'): string[] {
  const { result } = renderHook(() => useAvailableTools(zone, workspace))
  return result.current.map(tool => tool.id)
}

beforeEach(() => {
  useModels.setState({ selected: {} })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
})

describe('the generator', () => {
  it('is offered where a model was chosen', () => {
    useModels.setState({ selected: { image: 'flux-dev' } })
    expect(idsOf('right', 'image')).toContain('generator')
  })

  it('is absent where none was — generating is impossible without one', () => {
    expect(idsOf('right', 'image')).not.toContain('generator')
  })

  it('counts the preferred model, which is what that preference is for', () => {
    preferModel('image', 'flux-dev')
    expect(hasModelFor('image')).toBe(true)
  })

  it('reads the section, not a shared family: textures no longer follows image', () => {
    useModels.setState({ selected: { image: 'flux-dev' } })
    expect(hasModelFor('image')).toBe(true)
    expect(hasModelFor('textures')).toBe(false)
  })

  it('is the only panel its absence removes', () => {
    expect(idsOf('right', 'image')).toEqual(['models', 'inspector'])
  })
})
