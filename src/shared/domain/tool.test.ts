import { describe, expect, it } from 'vitest'
import {
  AI_TOOLS,
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
    const strips: readonly WorkspaceId[] = ['image', '3d', 'textures', 'skyboxes', 'audio']
    for (const workspace of strips) expect(placementIn('assets', workspace)?.zone).toBe('bottom')
  })

  it('keeps it beside the montage where a take is dragged onto a track', () => {
    expect(placementIn('assets', 'video')?.zone).toBe('left')
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

describe('the upper half of the right column', () => {
  it('holds the AI panels, and only them', () => {
    const upper = TOOL_PLACEMENTS.filter(
      placement => placement.zone === 'right' && placement.slot === 'primary',
    )
    expect(new Set(upper.map(placement => placement.id))).toEqual(new Set(AI_TOOLS))
  })

  it('is the only place they sit', () => {
    for (const id of AI_TOOLS) {
      for (const placement of placementsOf(id)) {
        expect(placement.zone).toBe('right')
        expect(placement.slot).toBe('primary')
      }
    }
  })
})
