import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { ModelFamily } from '@shared/domain/model'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { hasModelFor, shownTool, useAvailableTools } from './tool-registry'

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

describe('what a half of a zone shows', () => {
  it('shows the tool it holds', () => {
    expect(shownTool('inspector', 'right', 'image', false)).toBe('inspector')
  })

  it('shows nothing where the section does not serve that tool', () => {
    expect(shownTool('layers', 'left', 'audio', true)).toBeNull()
  })

  it('shows nothing where the tool sits in another zone in this section', () => {
    // The shelf is in the left column in Video, so the bottom band must not draw it too.
    expect(shownTool('assets', 'bottom', 'video', true)).toBeNull()
    expect(shownTool('assets', 'left', 'video', true)).toBe('assets')
  })

  it('falls back to the models panel where the generator has no model', () => {
    expect(shownTool('generator', 'right', 'image', false)).toBe('models')
  })

  it('shows the generator again as soon as one is there', () => {
    expect(shownTool('generator', 'right', 'image', true)).toBe('generator')
  })
})
