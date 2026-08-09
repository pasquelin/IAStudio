import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { ModelFamily } from '@shared/domain/model'
import type { ToolZone } from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
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

function idsOf(zone: ToolZone, workspace: WorkspaceId): string[] {
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
    expect(idsOf('left', 'image')).toContain('generator')
  })

  it('is absent where none was — generating is impossible without one', () => {
    expect(idsOf('left', 'image')).not.toContain('generator')
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
    expect(idsOf('left', 'image')).toEqual(['models'])
    useModels.setState({ selected: { image: 'flux-dev' } })
    expect(idsOf('left', 'image')).toEqual(['models', 'generator'])
  })

  // Named for what it checks: `canOffer` answers for the generator and for nothing else, so a
  // section with no model still shows every panel of its right column.
  it('leaves the right column alone — no model removes anything there', () => {
    expect(idsOf('right', 'textures')).toEqual([
      'channels',
      'styles',
      'explorer',
      'apps',
      'inspector',
    ])
  })
})

// A half nobody has chosen for holds `null`, and each section answers it on its own: what is
// open is stored once for all six, while the panel that comes first differs in each.
describe('a half open on no panel in particular', () => {
  it('shows the one this section declares first', () => {
    expect(shownTool(null, 'right', 'primary', 'image', true)).toBe('layers')
    expect(shownTool(null, 'right', 'primary', '3d', true)).toBe('explorer')
    expect(shownTool(null, 'right', 'primary', 'video', true)).toBe('assets')
    expect(shownTool(null, 'right', 'primary', 'skyboxes', true)).toBe('skybox')
    expect(shownTool(null, 'right', 'primary', 'textures', true)).toBe('channels')
  })

  it('reads the band as the shelf or the montage, per section', () => {
    expect(shownTool(null, 'bottom', 'primary', 'image', true)).toBe('assets')
    expect(shownTool(null, 'bottom', 'primary', 'audio', true)).toBe('timeline')
  })

  it('never opens on a generator the section cannot offer', () => {
    expect(shownTool(null, 'left', 'primary', 'image', false)).toBe('models')
    expect(shownTool(null, 'left', 'primary', 'image', true)).toBe('models')
  })

  // The distinction the store draws: an absent key is a closed half, `null` an open one. Reading
  // both as "nothing" would close every half nobody has clicked.
  it('is not a closed half, which shows nothing at all', () => {
    expect(shownTool(undefined, 'right', 'primary', 'image', true)).toBeNull()
  })

  it('shows nothing where the section fills no such half', () => {
    expect(shownTool(null, 'left', 'secondary', 'image', true)).toBeNull()
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
    expect(shownTool('assets', 'right', 'primary', 'video', true)).toBe('assets')
    expect(shownTool('assets', 'bottom', 'primary', 'image', true)).toBe('assets')
  })

  it('substitutes within the half, never across the separator', () => {
    expect(shownTool('inspector', 'right', 'primary', 'image', true)).toBe('layers')
    expect(shownTool('layers', 'right', 'secondary', 'image', true)).toBe('inspector')
  })

  it('answers null for a half this section does not fill', () => {
    // The left column is one half: generating is a single panel, whichever of the two shows it.
    expect(shownTool('models', 'left', 'secondary', 'image', true)).toBeNull()
    expect(shownTool('assets', 'bottom', 'secondary', 'image', true)).toBeNull()
  })

  it('never substitutes a generator a section cannot offer', () => {
    expect(shownTool('inspector', 'left', 'primary', 'image', false)).toBe('models')
  })

  // Where several tools share a half, the substitute is the first the registry declares. The
  // order of `TOOL_PLACEMENTS` is the choice, so it is spelled out here rather than left to
  // whoever reorders that table next.
  it('substitutes the first tool the half declares when several share it', () => {
    expect(shownTool('layers', 'right', 'primary', '3d', true)).toBe('explorer')
    expect(shownTool('layers', 'right', 'primary', 'skyboxes', true)).toBe('skybox')
  })

  it('falls back to the models panel where the generator has no model', () => {
    expect(shownTool('generator', 'left', 'primary', 'image', false)).toBe('models')
  })

  it('shows the generator again as soon as one is there', () => {
    expect(shownTool('generator', 'left', 'primary', 'image', true)).toBe('generator')
  })
})
