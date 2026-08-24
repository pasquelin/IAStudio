import { describe, expect, it } from 'vitest'
import {
  SCENARIO_TOOLS,
  isHorizontal,
  placementIn,
  placementOf,
  placementsOf,
  HOME_SURFACE,
  serves,
  TOOL_PLACEMENTS,
  type ToolId,
  type ToolSlot,
  type ToolSurface,
  type ToolZone,
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
  // One placement for all six, where there used to be two: the shelf reads the same question
  // in every space — what can I get from Scenario — so it has no reason to move with the space.
  it('puts the asset shelf in the left column of every workspace', () => {
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('assets', workspace)?.zone).toBe('left')
      expect(placementIn('assets', workspace)?.slot).toBe('primary')
    }
  })

  it('serves the shelf in every workspace — it is never simply absent', () => {
    for (const workspace of WORKSPACE_IDS) expect(placementIn('assets', workspace)).not.toBeNull()
  })

  it('answers null for a workspace a tool does not serve', () => {
    expect(placementIn('timeline', 'image')).toBeNull()
    expect(placementIn('layers', '3d')).toBeNull()
  })

  it('answers null for an id no version knows any more', () => {
    expect(placementIn('moodboard', 'image')).toBeNull()
    expect(placementOf('moodboard')).toBeNull()
  })
})

describe('every workspace', () => {
  it('has somewhere to generate from', () => {
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('generator', workspace)).not.toBeNull()
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
   * FIVE placements, where there were eleven until 13 August. The eight that went answered a
   * question about the studio — what it spent, how many assets it holds by kind, the newest ones,
   * favourites, ideas, look-alikes, and two journals the status bar already carries — and this
   * screen is where one comes to OPEN something. The list is spelled out rather than counted: an
   * id creeping back in is the exact regression this holds against.
   *
   * The two that came back are the two about the project that is OPEN, and both are withheld
   * while none is: what has changed in its folder, and what came before. That is a different
   * thing from the eight, which spoke about the studio whether or not anything was open.
   *
   * The order is the order of the rail, and the first of a half is what an unchosen half draws —
   * so this holds both the icon stack and what the screen opens on.
   */
  it('stands its panels in two columns and a band, in the order their icons stack', () => {
    const served = TOOL_PLACEMENTS.filter(placement => serves(placement, HOME_SURFACE))

    expect(served.map(placement => [placement.id, placement.zone, placement.slot])).toEqual([
      ['projects', 'left', 'primary'],
      ['explorer', 'left', 'secondary'],
      ['library', 'right', 'primary'],
      // Declared LAST on purpose, and the order is what says so: the folder is what an unchosen
      // half opens on, and the versions of that folder are what one goes to look at next.
      ['git', 'left', 'secondary'],
      ['history', 'bottomRight', 'primary'],
    ])
  })

  /**
   * The rule every space follows: the left is what one opens FROM, the right is what one opens.
   *
   * The left column now holds both halves, as every space does — the projects above, and under
   * them the one that is open, read as a folder. The right keeps one: a rota there is where the
   * projects stopped being the thing this screen opens on.
   *
   * The BAND is new on 17 August, and it is the one zone this screen had never had. What it
   * holds is read across — a history is one commit per line, and a branch graph in a 280 px
   * column is a graph nobody can follow — and it is offered only while a project is open, so the
   * screen a reader arrives on with nothing open is the one it has always been.
   */
  it('reads its two columns the way every space reads its own', () => {
    const served = TOOL_PLACEMENTS.filter(placement => serves(placement, HOME_SURFACE))
    const inHalf = (zone: ToolZone, slot: ToolSlot): string[] =>
      served
        .filter(placement => placement.zone === zone && placement.slot === slot)
        .map(placement => placement.id)

    expect(inHalf('left', 'primary')).toEqual(['projects'])
    // A rota of two: the open project read as a folder, and the same folder read as a history.
    expect(inHalf('left', 'secondary')).toEqual(['explorer', 'git'])
    expect(inHalf('right', 'primary')).toEqual(['library'])
    expect(inHalf('right', 'secondary')).toEqual([])
    expect(inHalf('bottomRight', 'primary')).toEqual(['history'])
    // The band's left half is where a panel is DRAGGED, never where one is declared.
    expect(inHalf('bottomLeft', 'primary')).toEqual([])
  })

  /**
   * They read the studio rather than a document, which is what a workspace's columns are not
   * for: a panel of recent projects beside an editor is a panel about somewhere else.
   */
  it('keeps its panels to itself, and takes none of the workspaces', () => {
    for (const id of ['projects', 'library']) {
      expect(placementsOf(id)).toHaveLength(1)
      for (const workspace of WORKSPACE_IDS) expect(placementIn(id, workspace)).toBeNull()
    }
  })

  /**
   * The Explorer left this surface for the projects on 10 August and came back on the 17th, as
   * the project folder itself rather than as the flat list of documents that stood in for it.
   *
   * The same half in all seven, and that is not a preference: a tool is held to ONE slot across
   * its placements — a panel that changed rows of the rail depending on where you came from is
   * a panel this registry cannot express.
   */
  it('keeps the Explorer in one half, here as in every space', () => {
    expect(placementsOf('explorer')).toHaveLength(2)
    const everywhere: readonly ToolSurface[] = [...WORKSPACE_IDS, HOME_SURFACE]
    for (const surface of everywhere) {
      expect(placementIn('explorer', surface)).toMatchObject({ zone: 'left', slot: 'secondary' })
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
  it('holds the Scenario panels, and only them, in the upper half of every workspace', () => {
    for (const workspace of WORKSPACE_IDS) {
      const upper = TOOL_PLACEMENTS.filter(
        placement =>
          placement.zone === 'left' && placement.slot === 'primary' && serves(placement, workspace),
      )
      expect(new Set(upper.map(placement => placement.id))).toEqual(new Set(SCENARIO_TOOLS))
    }
  })

  it('is the only place they sit, and the same place in every workspace', () => {
    for (const id of SCENARIO_TOOLS) {
      for (const placement of placementsOf(id)) {
        expect(placement.zone).toBe('left')
        expect(placement.slot).toBe('primary')
      }
      expect(placementsOf(id)).toHaveLength(1)
    }
  })

  /**
   * Three turns above, two below, and the cut between them is what the column MEANS: what
   * Scenario offers, then what is already on my disk. The half is what keeps the shelf visible
   * WHILE the Explorer is read — which is the whole of the gesture that pulls one into the
   * other, and which taking turns would forbid by construction.
   */
  it('holds what one produces with in its lower half, and nothing else', () => {
    // The spaces' own half. The home's left column is the same zone and the same slot, and it
    // holds the projects — a surface that calls no model, so the rule above is not about it.
    const lower = TOOL_PLACEMENTS.filter(
      placement =>
        placement.zone === 'left' &&
        placement.slot === 'secondary' &&
        WORKSPACE_IDS.some(workspace => serves(placement, workspace)),
    )

    // Two, and both read the PROJECT FOLDER — as a tree, and as a history of the same files.
    // That is what keeps them one rota rather than a pile: whichever is in front, the half is
    // still "the folder I am working in". A third reading of something else would not belong.
    expect(lower.map(placement => placement.id)).toEqual(['explorer', 'git'])
  })
})

describe('the rail order of the upper right', () => {
  // What the right keeps once the Explorer has gone left: what acts on the document that is
  // already open, and only that.
  it('reads the panels of the document, and no longer the Explorer', () => {
    expect(upperRightIn('image')).toEqual(['layers', 'text'])
  })

  it('reads the scene in 3D, and no longer the shelf', () => {
    expect(upperRightIn('3d')).toEqual(['scene', 'lights', 'meshes', 'animations'])
  })

  /**
   * EMPTY, and it is the shelf leaving that empties it: these two spaces put nothing else in
   * that half. Asserted rather than left unsaid — a half with no tool is a state the rail and
   * the shell have to survive, and the day something is declared there this line is what asks
   * whether it belongs.
   */
  it('leaves the upper right of Video and Audio to nothing at all', () => {
    expect(upperRightIn('video')).toEqual([])
    expect(upperRightIn('audio')).toEqual([])
  })

  /**
   * Nothing at all, since what a sky IS and how it is LOOKED at both went back to the inspector —
   * the first on 2026-08-19, the second right after. Two boxes describing one document were two
   * places to learn to find, and the second sat above an inspector reading "select something".
   */
  it('leaves the upper right of Skyboxes to the inspector alone', () => {
    expect(upperRightIn('skyboxes')).toEqual([])
  })

  /**
   * Nothing either, and for the same reason: the eight channels and the saved styles both became
   * sections of the inspector on 2026-08-19. Textures was the last space to stack three boxes on
   * one document — what it IS, what reads it, and the panel that describes what is selected.
   */
  it('leaves the upper right of Textures to the inspector alone', () => {
    expect(upperRightIn('textures')).toEqual([])
  })
})

describe('the montage band', () => {
  it('is the timeline wherever there is time to read, and free everywhere else', () => {
    const timed: readonly WorkspaceId[] = ['video', 'audio', '3d']
    for (const workspace of WORKSPACE_IDS) {
      expect(placementIn('timeline', workspace)?.zone ?? null).toBe(
        timed.includes(workspace) ? 'bottomRight' : null,
      )
    }
  })

  /**
   * What the band holds in the three spaces with no montage: the history, and nothing else. It
   * used to be the shelf, and the band emptied when the shelf went to the left column — a zone
   * whose only tool is one nobody opens by default is a zone that reads as broken, so the fact
   * that ONE tool is still declared there is worth an assertion rather than a hope.
   */
  it('still offers the history in the spaces that have no montage', () => {
    const untimed: readonly WorkspaceId[] = ['image', 'textures', 'skyboxes']
    for (const workspace of untimed) {
      expect(placementIn('history', workspace)?.zone).toBe('bottomRight')
    }
  })
})
