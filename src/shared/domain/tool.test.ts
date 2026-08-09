import { describe, expect, it } from 'vitest'
import {
  GENERATION_TOOLS,
  isHorizontal,
  placementIn,
  placementOf,
  placementsOf,
  HOME_SURFACE,
  serves,
  TOOL_PLACEMENTS,
  type ToolId,
} from './tool'
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

const TOOL_IDS: ToolId[] = [...new Set(TOOL_PLACEMENTS.map(placement => placement.id))]

/** The upper right in declaration order — which is the order the rail stacks its icons. */
function upperRightIn(workspace: WorkspaceId): ToolId[] {
  return TOOL_PLACEMENTS.filter(
    placement =>
      placement.zone === 'right' && placement.slot === 'primary' && serves(placement, workspace),
  ).map(placement => placement.id)
}

describe('the placements of one tool', () => {
  it('never overlap — a workspace must not have to choose between two zones', () => {
    for (const id of TOOL_IDS) {
      for (const workspace of WORKSPACE_IDS) {
        const serving = placementsOf(id).filter(placement => serves(placement, workspace))
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
      expect(TOOL_PLACEMENTS.some(placement => serves(placement, workspace))).toBe(true)
    }
  })

  it('is named by the placements that claim it', () => {
    const known: readonly string[] = [...WORKSPACE_IDS, HOME_SURFACE]
    for (const placement of TOOL_PLACEMENTS) {
      for (const surface of placement.surfaces) expect(known).toContain(surface)
    }
  })
})

describe('the home', () => {
  it('stands the Explorer in its left column, where a panel is reached from the rail', () => {
    expect(placementIn('explorer', HOME_SURFACE)).toMatchObject({ zone: 'left', slot: 'secondary' })
  })

  /**
   * One placement, not two, and that is the point: the panel keeps the same half and the same
   * rail row on the home as in the spaces. The home has no generation for it to sit under, and
   * `Edge` gives a lone half the whole zone — so it fills the column there, as it always did.
   */
  it('reaches the Explorer through the same placement the spaces use', () => {
    expect(placementsOf('explorer')).toHaveLength(1)
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('explorer', workspace)).toMatchObject({ zone: 'left', slot: 'secondary' })
    }
  })

  /**
   * The rest act on an open document, and the home has none — the shell draws it no right rail
   * and no bottom strip, so a placement reaching them would be an icon nothing can show.
   */
  it('offers the Explorer and nothing else', () => {
    const served = TOOL_PLACEMENTS.filter(placement => serves(placement, HOME_SURFACE))
    expect(served.map(placement => placement.id)).toEqual(['explorer'])
  })

  it('is not a workspace: no document kind or workspace menu can name it', () => {
    const surfaces: readonly string[] = WORKSPACE_IDS
    expect(surfaces).not.toContain(HOME_SURFACE)
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
  it('holds the generation panels, and only them, in the upper half of every workspace', () => {
    for (const workspace of WORKSPACE_IDS) {
      const upper = TOOL_PLACEMENTS.filter(
        placement =>
          placement.zone === 'left' && placement.slot === 'primary' && serves(placement, workspace),
      )
      expect(new Set(upper.map(placement => placement.id))).toEqual(new Set(GENERATION_TOOLS))
    }
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

  /**
   * Two halves of two, never four turns in one. Four icons stacked in a rail is the moment a
   * column stops being a place one knows and becomes a pile one searches — and a half keeps the
   * generator visible WHILE the Explorer is read, which taking turns forbids by construction.
   */
  it('holds what one produces with in its lower half, and nothing else', () => {
    const lower = TOOL_PLACEMENTS.filter(
      placement => placement.zone === 'left' && placement.slot === 'secondary',
    )

    expect(lower.map(placement => placement.id)).toEqual(['explorer', 'apps'])
  })
})

describe('the rail order of the upper right', () => {
  // What the right keeps once the Explorer and the Apps have gone left: what acts on the
  // document that is already open, and only that.
  it('reads the panels of the document, and no longer the Explorer or the Apps', () => {
    expect(upperRightIn('image')).toEqual(['layers'])
    expect(upperRightIn('3d')).toEqual(['scene', 'lights', 'meshes'])
  })

  it('puts the shelf first where a take is dragged onto a track', () => {
    expect(upperRightIn('video')).toEqual(['assets'])
    expect(upperRightIn('audio')).toEqual(['assets'])
  })

  // `view` sits right behind them: how a sky is being looked at is next of kin to what it is,
  // and both used to be a menu floating over the picture.
  it('puts the sky controls first in Skyboxes — it is what that space is for', () => {
    expect(upperRightIn('skyboxes')).toEqual(['skybox', 'view'])
  })

  /** Same rule, same reason: a texture IS its eight channels, so they come before the files. */
  it('puts the channels first in Textures, with the styles that read them beside', () => {
    expect(upperRightIn('textures')).toEqual(['channels', 'styles'])
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
