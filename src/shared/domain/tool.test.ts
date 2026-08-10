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
  /**
   * Two columns and no band, which is what makes it a surface like the others: what one opens on
   * the left, what the open project holds on the right, and the centre kept for the page.
   *
   * The order is the order of the rail, and the first of a half is what an unchosen half draws —
   * so this holds both the icon stack and what the screen opens on.
   */
  it('stands its panels in two columns, in the order their icons stack', () => {
    const served = TOOL_PLACEMENTS.filter(placement => serves(placement, HOME_SURFACE))

    expect(served.map(placement => [placement.id, placement.zone, placement.slot])).toEqual([
      ['projects', 'left', 'secondary'],
      ['creations', 'right', 'primary'],
      ['counts', 'right', 'primary'],
      ['library', 'right', 'primary'],
      ['documents', 'right', 'primary'],
      ['activity', 'right', 'secondary'],
    ])
  })

  /**
   * They read the studio rather than a document, which is what a workspace's columns are not
   * for: a panel of recent projects beside an editor is a panel about somewhere else.
   */
  it('keeps its panels to itself, and takes none of the workspaces', () => {
    for (const id of ['projects', 'creations', 'counts', 'library', 'documents', 'activity']) {
      expect(placementsOf(id)).toHaveLength(1)
      for (const workspace of WORKSPACE_IDS) expect(placementIn(id, workspace)).toBeNull()
    }
  })

  /**
   * The Explorer left this surface for the projects on 10 August. Its list did not: the home's
   * right column draws it under `documents`, which is the name that screen gives it — one
   * folder read once, rather than a shelf and a tree that had drifted apart.
   */
  it('leaves the Explorer to the spaces, where it keeps one placement for all seven', () => {
    expect(placementIn('explorer', HOME_SURFACE)).toBeNull()
    expect(placementsOf('explorer')).toHaveLength(1)
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('explorer', workspace)).toMatchObject({ zone: 'left', slot: 'secondary' })
    }
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
    // The spaces' own half. The home's left column is the same zone and the same slot, and it
    // holds the projects — a surface that generates nothing, so the rule above is not about it.
    const lower = TOOL_PLACEMENTS.filter(
      placement =>
        placement.zone === 'left' &&
        placement.slot === 'secondary' &&
        WORKSPACE_IDS.some(workspace => serves(placement, workspace)),
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
