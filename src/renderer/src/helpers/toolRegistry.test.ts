import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { HOME_SURFACE, TOOL_PLACEMENTS, type ToolId, type ToolZone } from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { preferModels } from '@/stores/settings-fixtures'
import { useProject } from '@/stores/project'
import { useAvailableTools } from '@/hooks/useAvailableTools'
import { shownTool, toolIcon, toolStateOf, TOOLS, type ToolState } from './toolRegistry'

/** What a workspace answers to: a project is always open in one, by definition. */
const WITH_MODEL: ToolState = { hasModel: true, hasProject: true }
const NO_MODEL: ToolState = { hasModel: false, hasProject: true }
/** The home before anything has been opened, which is where a launch starts. */
const NO_PROJECT: ToolState = { hasModel: false, hasProject: false }

/** The half of `toolStateOf` these cases are about, read where they used to read it alone. */
const hasModelIn = (surface: Parameters<typeof toolStateOf>[0]): boolean =>
  toolStateOf(surface).hasModel

/** A project open, which is what the home's Explorer answers to. */
const openProject = (): void => {
  useProject.setState({
    project: {
      path: '/projects/demo',
      manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
    },
  })
}

function idsOf(zone: ToolZone, workspace: WorkspaceId | typeof HOME_SURFACE): string[] {
  const { result } = renderHook(() => useAvailableTools(zone, workspace))
  return result.current.map(tool => tool.id)
}

beforeEach(() => {
  useModels.setState({ selected: {} })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useProject.setState({ project: null })
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
    preferModels({ image: 'flux-dev' })
    expect(hasModelIn('image')).toBe(true)
  })

  it('reads the section, not a shared family: textures no longer follows image', () => {
    useModels.setState({ selected: { image: 'flux-dev' } })
    expect(hasModelIn('image')).toBe(true)
    expect(hasModelIn('textures')).toBe(false)
  })

  it('is the only panel its absence removes', () => {
    expect(idsOf('left', 'image')).toEqual(['models', 'explorer'])
    useModels.setState({ selected: { image: 'flux-dev' } })
    expect(idsOf('left', 'image')).toEqual(['models', 'generator', 'explorer'])
  })

  /** The home is the one surface with nothing to generate at all, and it stays that way. */
  it('is never offered on the home, whatever has been chosen elsewhere', () => {
    useModels.setState({ selected: { image: 'flux-dev' } })

    expect(hasModelIn(HOME_SURFACE)).toBe(false)
  })

  /** A choice made in one space is not a choice made in another: the scopes are separate keys. */
  it('keeps a space’s choice out of the spaces that have another family', () => {
    useModels.setState({ selected: { texture: 'flux-dev' } })

    expect(hasModelIn('image')).toBe(false)
  })

  // Named for what it checks: a section with no model still shows every panel of its right
  // column — the two state rules answer for the generator and for the home's Explorer, and for
  // nothing else.
  it('leaves the right column alone — no model removes anything there', () => {
    expect(idsOf('right', 'textures')).toEqual(['channels', 'styles', 'inspector'])
  })
})

/**
 * The one panel the HOME offers conditionally. It reads a project folder, and the home is where
 * one is opened: standing there with none, it would say « no project open » beside the very
 * shelf that opens one. Every space keeps it whatever happens — a space IS a project being
 * edited.
 */
describe('the explorer on the home', () => {
  it('is absent while no project is open, and there the moment one is', () => {
    expect(idsOf('left', HOME_SURFACE)).toEqual(['projects'])

    openProject()
    // Two panels answer to a project on this screen now, and both for the same reason: the
    // folder, and the history of that folder.
    expect(idsOf('left', HOME_SURFACE)).toEqual(['projects', 'explorer', 'git'])
  })

  it('stays in every space, which is a project already open', () => {
    expect(idsOf('left', 'image')).toContain('explorer')
  })

  // The half falls back to what the surface does put there — and the home has no Models panel
  // to fall back ON, which is what the workspaces' own fallback would have handed it.
  it('leaves its half empty rather than standing something else in it', () => {
    expect(shownTool('explorer', 'left', 'secondary', HOME_SURFACE, NO_PROJECT)).toBeNull()
    expect(shownTool('explorer', 'left', 'secondary', HOME_SURFACE, WITH_MODEL)).toBe('explorer')
  })
})

// A half nobody has chosen for holds `null`, and each section answers it on its own: what is
// open is stored once for all six, while the panel that comes first differs in each.
describe('a half open on no panel in particular', () => {
  it('shows the one this section declares first', () => {
    expect(shownTool(null, 'right', 'primary', 'image', WITH_MODEL)).toBe('layers')
    expect(shownTool(null, 'right', 'primary', '3d', WITH_MODEL)).toBe('scene')
    expect(shownTool(null, 'right', 'primary', 'video', WITH_MODEL)).toBe('assets')
    expect(shownTool(null, 'right', 'primary', 'skyboxes', WITH_MODEL)).toBe('skybox')
    expect(shownTool(null, 'right', 'primary', 'textures', WITH_MODEL)).toBe('channels')
  })

  it('reads the band as the shelf or the montage, per section', () => {
    expect(shownTool(null, 'bottom', 'primary', 'image', WITH_MODEL)).toBe('assets')
    expect(shownTool(null, 'bottom', 'primary', 'audio', WITH_MODEL)).toBe('timeline')
  })

  it('never opens on a generator the section cannot offer', () => {
    expect(shownTool(null, 'left', 'primary', 'image', NO_MODEL)).toBe('models')
    expect(shownTool(null, 'left', 'primary', 'image', WITH_MODEL)).toBe('models')
  })

  // The distinction the store draws: an absent key is a closed half, `null` an open one. Reading
  // both as "nothing" would close every half nobody has clicked.
  it('is not a closed half, which shows nothing at all', () => {
    expect(shownTool(undefined, 'right', 'primary', 'image', WITH_MODEL)).toBeNull()
  })

  it('shows nothing where the section fills no such half', () => {
    expect(shownTool(null, 'bottom', 'secondary', 'image', WITH_MODEL)).toBeNull()
  })

  // The lower half of the left column, which the Explorer took over.
  it('opens the lower left on the first panel that half declares', () => {
    expect(shownTool(null, 'left', 'secondary', 'image', WITH_MODEL)).toBe('explorer')
  })
})

describe('what a half of a zone shows', () => {
  it('shows the tool it holds', () => {
    expect(shownTool('inspector', 'right', 'secondary', 'image', NO_MODEL)).toBe('inspector')
  })

  // What the user opened is a zone, and it stays that zone across sections: the band holds the
  // montage in Video and the shelf everywhere else, neither reopened by hand on every switch.
  it('shows what this section puts there when the tool it holds sits elsewhere', () => {
    expect(shownTool('assets', 'bottom', 'primary', 'video', WITH_MODEL)).toBe('timeline')
    expect(shownTool('timeline', 'bottom', 'primary', 'image', WITH_MODEL)).toBe('assets')
  })

  it('leaves a tool alone in the zone this section gives it', () => {
    expect(shownTool('assets', 'right', 'primary', 'video', WITH_MODEL)).toBe('assets')
    expect(shownTool('assets', 'bottom', 'primary', 'image', WITH_MODEL)).toBe('assets')
  })

  it('substitutes within the half, never across the separator', () => {
    expect(shownTool('inspector', 'right', 'primary', 'image', WITH_MODEL)).toBe('layers')
    expect(shownTool('layers', 'right', 'secondary', 'image', WITH_MODEL)).toBe('inspector')
  })

  it('answers null for a half this section does not fill', () => {
    // A band is read across its width, so it has no second half for anything to substitute into.
    expect(shownTool('assets', 'bottom', 'secondary', 'image', WITH_MODEL)).toBeNull()
  })

  it('never substitutes a generator a section cannot offer', () => {
    expect(shownTool('inspector', 'left', 'primary', 'image', NO_MODEL)).toBe('models')
  })

  // Where several tools share a half, the substitute is the first the registry declares. The
  // order of `TOOL_PLACEMENTS` is the choice, so it is spelled out here rather than left to
  // whoever reorders that table next.
  it('substitutes the first tool the half declares when several share it', () => {
    expect(shownTool('layers', 'right', 'primary', '3d', WITH_MODEL)).toBe('scene')
    expect(shownTool('layers', 'right', 'primary', 'skyboxes', WITH_MODEL)).toBe('skybox')
  })

  it('falls back to the models panel where the generator has no model', () => {
    expect(shownTool('generator', 'left', 'primary', 'image', NO_MODEL)).toBe('models')
  })

  it('shows the generator again as soon as one is there', () => {
    expect(shownTool('generator', 'left', 'primary', 'image', WITH_MODEL)).toBe('generator')
  })
})

describe('the glyphs of the rail', () => {
  /**
   * One glyph, one meaning. The comment above `ICONS` promises it, and only a test keeps the
   * promise: `counts` wore the mesh node's glyph for a day — harmless, since the two never share
   * a rail, but a rail one reads twice starts exactly there.
   */
  it('gives every panel a glyph of its own', () => {
    const ids = TOOL_PLACEMENTS.map(placement => placement.id)
    const byIcon = new Map<string, ToolId>()

    for (const id of ids) {
      const icon = toolIcon(id)
      const held = byIcon.get(icon)
      expect(held ?? id).toBe(id)
      byIcon.set(icon, id)
    }
  })

  it('hands the panels the same glyph the rail draws', () => {
    for (const tool of TOOLS) expect(tool.icon).toBe(toolIcon(tool.id))
  })
})
