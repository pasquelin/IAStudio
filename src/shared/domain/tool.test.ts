import { describe, expect, it } from 'vitest'
import {
  GENERATION_TOOLS,
  isHorizontal,
  placementIn,
  placementOf,
  placementsOf,
  servesWorkspace,
  TOOL_PLACEMENTS,
  type ToolId,
} from './tool'
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

const TOOL_IDS: ToolId[] = [...new Set(TOOL_PLACEMENTS.map(placement => placement.id))]

/** The upper right in declaration order — which is the order the rail stacks its icons. */
function upperRightIn(workspace: WorkspaceId): ToolId[] {
  return TOOL_PLACEMENTS.filter(
    placement =>
      placement.zone === 'right' &&
      placement.slot === 'primary' &&
      servesWorkspace(placement, workspace),
  ).map(placement => placement.id)
}

describe('the placements of one tool', () => {
  it('never overlap — a workspace must not have to choose between two zones', () => {
    for (const id of TOOL_IDS) {
      for (const workspace of WORKSPACE_IDS) {
        const serving = placementsOf(id).filter(placement => servesWorkspace(placement, workspace))
        expect(serving.length).toBeLessThanOrEqual(1)
      }
    }
  })

  it('share a slot, or the tool would change rail row with the workspace', () => {
    for (const id of TOOL_IDS) {
      const slots = new Set(placementsOf(id).map(placement => placement.slot))
      expect(slots.size).toBe(1)
    }
  })
})

describe('resolving where a tool sits', () => {
  it('puts the asset shelf in the bottom strip everywhere it is a shelf', () => {
    const strips: readonly WorkspaceId[] = ['image', '3d', 'textures', 'skyboxes']
    for (const workspace of strips) expect(placementIn('assets', workspace)?.zone).toBe('bottom')
  })

  it('keeps it beside the montage where a take is dragged onto a track', () => {
    expect(placementIn('assets', 'video')?.zone).toBe('right')
    expect(placementIn('assets', 'audio')?.zone).toBe('right')
  })

  it('serves the shelf in every workspace — it is never simply absent', () => {
    for (const workspace of WORKSPACE_IDS) expect(placementIn('assets', workspace)).not.toBeNull()
  })

  it('answers null for a workspace a tool does not serve', () => {
    expect(placementIn('timeline', 'image')).toBeNull()
    expect(placementIn('skybox', '3d')).toBeNull()
  })

  it('answers null for an id no version knows any more', () => {
    expect(placementIn('moodboard', 'image')).toBeNull()
    expect(placementOf('moodboard')).toBeNull()
  })
})

describe('the skybox panel', () => {
  it('serves only its own workspace', () => {
    expect(placementIn('skybox', 'skyboxes')?.zone).toBe('right')
    for (const workspace of WORKSPACE_IDS) {
      if (workspace !== 'skyboxes') expect(placementIn('skybox', workspace)).toBeNull()
    }
  })

  it('does not share a half with the inspector, which serves every workspace', () => {
    const skybox = placementIn('skybox', 'skyboxes')
    const inspector = placementIn('inspector', 'skyboxes')

    expect(inspector).not.toBeNull()
    expect(skybox?.zone === inspector?.zone && skybox?.slot === inspector?.slot).toBe(false)
  })
})

describe('every workspace', () => {
  it('has somewhere to generate from', () => {
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('generator', workspace)).not.toBeNull()
      expect(placementIn('models', workspace)).not.toBeNull()
    }
  })

  it('can inspect what is selected, from the lower half of the right column', () => {
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('inspector', workspace)).toMatchObject({
        zone: 'right',
        slot: 'secondary',
      })
    }
  })

  it('is served by at least one panel', () => {
    for (const workspace of WORKSPACE_IDS) {
      expect(TOOL_PLACEMENTS.some(placement => servesWorkspace(placement, workspace))).toBe(true)
    }
  })

  it('is named by the placements that claim it', () => {
    for (const placement of TOOL_PLACEMENTS) {
      for (const workspace of placement.workspaces) expect(WORKSPACE_IDS).toContain(workspace)
    }
  })
})

describe('a horizontal band', () => {
  it('is never cut in two — it holds one panel across its width', () => {
    for (const placement of TOOL_PLACEMENTS) {
      if (isHorizontal(placement.zone)) expect(placement.slot).toBe('primary')
    }
  })
})

describe('the left column', () => {
  it('holds the generation panels, and only them', () => {
    const left = TOOL_PLACEMENTS.filter(placement => placement.zone === 'left')
    expect(new Set(left.map(placement => placement.id))).toEqual(new Set(GENERATION_TOOLS))
  })

  it('is the only place they sit, and the same place in every workspace', () => {
    for (const id of GENERATION_TOOLS) {
      for (const placement of placementsOf(id)) {
        expect(placement.zone).toBe('left')
        expect(placement.slot).toBe('primary')
      }
      expect(placementsOf(id)).toHaveLength(1)
    }
  })

  it('is never cut in two — nothing shares the column with the generator', () => {
    for (const placement of TOOL_PLACEMENTS) {
      if (placement.zone === 'left') expect(placement.slot).toBe('primary')
    }
  })
})

describe('the rail order of the upper right', () => {
  it('reads layers then explorer in Image, and explorer before the scene panels in 3D', () => {
    expect(upperRightIn('image')).toEqual(['layers', 'explorer'])
    expect(upperRightIn('3d')).toEqual(['explorer', 'scene', 'lights', 'meshes'])
  })

  it('puts the shelf first where a take is dragged onto a track', () => {
    expect(upperRightIn('video')).toEqual(['assets', 'explorer'])
    expect(upperRightIn('audio')).toEqual(['assets', 'explorer'])
  })

  // `view` sits right behind them: how a sky is being looked at is next of kin to what it is,
  // and both used to be a menu floating over the picture.
  it('puts the sky controls first in Skyboxes — it is what that space is for', () => {
    expect(upperRightIn('skyboxes')).toEqual(['skybox', 'view', 'explorer'])
  })

  /** Same rule, same reason: a texture IS its eight channels, so they come before the files. */
  it('puts the channels first in Textures', () => {
    expect(upperRightIn('textures')).toEqual(['channels', 'explorer'])
  })
})

describe('the montage band', () => {
  it('is the timeline in Video and Audio, and the shelf everywhere else', () => {
    for (const workspace of WORKSPACE_IDS) {
      const band = workspace === 'video' || workspace === 'audio' ? 'timeline' : 'assets'
      expect(placementIn(band, workspace)?.zone).toBe('bottom')
    }
  })
})
