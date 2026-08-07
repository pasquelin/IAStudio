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
    expect(shownTool('inspector', 'right', 'secondary', 'image', false)).toBe('inspector')
  })

  // What the user opened is a zone, and it stays that zone across sections: the band holds the
  // montage in Video and the shelf everywhere else, neither reopened by hand on every switch.
  it('shows what this section puts there when the tool it holds sits elsewhere', () => {
    expect(shownTool('assets', 'bottom', 'primary', 'video', true)).toBe('timeline')
    expect(shownTool('timeline', 'bottom', 'primary', 'image', true)).toBe('assets')
  })

  it('leaves a tool alone in the zone this section gives it', () => {
    expect(shownTool('assets', 'left', 'primary', 'video', true)).toBe('assets')
    expect(shownTool('assets', 'bottom', 'primary', 'image', true)).toBe('assets')
  })

  it('substitutes within the half, never across the separator', () => {
    // Layers is an upper-left panel; Audio has nothing there, and the explorer below is not a
    // candidate — it would jump the separator the rail draws.
    expect(shownTool('layers', 'left', 'primary', 'audio', true)).toBeNull()
    expect(shownTool('layers', 'left', 'primary', 'video', true)).toBe('assets')
  })

  it('never substitutes a generator a section cannot offer', () => {
    expect(shownTool('skybox', 'right', 'primary', 'image', false)).toBe('models')
  })

  // The half is asked for by name, so a tool of the right zone but the other half is no more
  // this one's business than a tool of another zone — a band holds only a first half, and
  // that is the whole of what keeps one uncut.
  it('answers for the half it is asked about, not merely the zone', () => {
    expect(shownTool('inspector', 'right', 'primary', 'image', true)).toBe('models')
    expect(shownTool('assets', 'bottom', 'secondary', 'image', true)).toBeNull()
  })

  it('falls back to the models panel where the generator has no model', () => {
    expect(shownTool('generator', 'right', 'primary', 'image', false)).toBe('models')
  })

  it('shows the generator again as soon as one is there', () => {
    expect(shownTool('generator', 'right', 'primary', 'image', true)).toBe('generator')
  })
})
