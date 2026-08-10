import { beforeEach, describe, expect, it } from 'vitest'
import { arrangedFor } from './tool-fixtures'
import { HOME_SURFACE } from '@shared/domain/tool'
import {
  arrangementOf,
  DEFAULT_ARRANGEMENTS,
  DEFAULT_OPEN,
  DEFAULT_SIZES,
  migrateTools,
  fitZoneSize,
  fitSplit,
  MIN_CENTER,
  MIN_SIZE,
  MIN_SPLIT,
  openFrom,
  unchosen,
  useTools,
} from './tools'

describe('fitZoneSize', () => {
  it('leaves room for the documents area', () => {
    // 1000 wide, nothing opposite, 240 reserved for the center.
    expect(fitZoneSize(900, 1000, 0)).toBe(1000 - MIN_CENTER)
  })

  it('accounts for what the opposite zone already takes', () => {
    expect(fitZoneSize(900, 1000, 300)).toBe(1000 - 300 - MIN_CENTER)
  })

  it('honours the minimum size', () => {
    expect(fitZoneSize(10, 1000, 0)).toBe(MIN_SIZE)
  })

  it('lets an in-between size through, rounded', () => {
    expect(fitZoneSize(300.4, 1000, 0)).toBe(300)
  })

  it('never returns less than the minimum, even in a tiny window', () => {
    // Ceiling would be negative here; the floor must still win so the panel stays usable.
    expect(fitZoneSize(500, 200, 0)).toBe(MIN_SIZE)
  })
})

describe('tools store', () => {
  beforeEach(() => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: {}, sizes: {}, splits: {} }),
      focusedZone: null,
    })
  })

  it('clamps the stored size on resize', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottom: { primary: 'assets' } } }),
    })
    useTools.getState().resize('image', 'bottom', 900, 800)
    expect(arrangementOf(useTools.getState(), 'image').sizes.bottom).toBe(800 - MIN_CENTER)
  })

  it('keeps the center alive when both sides are dragged wide', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { left: { primary: 'generator' }, right: { primary: 'explorer' } },
      }),
    })
    const { resize } = useTools.getState()
    resize('image', 'left', 900, 1000)
    resize('image', 'right', 900, 1000)

    const { sizes } = arrangementOf(useTools.getState(), 'image')
    expect((sizes.left ?? 0) + (sizes.right ?? 0)).toBeLessThanOrEqual(1000 - MIN_CENTER)
  })

  it('re-clamps every zone when the window shrinks', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { left: { primary: 'models' } },
        sizes: { left: 600 },
      }),
    })
    useTools.getState().fit(800, 600)
    expect(arrangementOf(useTools.getState(), 'image').sizes.left).toBe(800 - MIN_CENTER)
  })

  it('opens a tool in the half its placement declares', () => {
    useTools.getState().show('image', 'right', 'layers')
    expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({ primary: 'layers' })
  })

  it('leaves the other half alone, so both show at once', () => {
    const { show } = useTools.getState()
    show('image', 'right', 'inspector')
    show('image', 'right', 'layers')

    expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
      primary: 'layers',
      secondary: 'inspector',
    })
  })

  it('swaps within a half rather than stacking, when two tools share it', () => {
    const { show } = useTools.getState()
    show('image', 'left', 'generator')
    show('image', 'left', 'models')

    expect(arrangementOf(useTools.getState(), 'image').open.left).toEqual({ primary: 'models' })
  })

  it('empties the half it is asked to close', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottom: { primary: 'assets' } } }),
    })
    useTools.getState().close('image', 'bottom', 'primary')
    expect(arrangementOf(useTools.getState(), 'image').open.bottom?.primary).toBeUndefined()
  })

  it('drops focus only once both halves are empty', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { right: { primary: 'layers', secondary: 'inspector' } },
      }),
      focusedZone: 'right',
    })
    const { close } = useTools.getState()

    close('image', 'right', 'secondary')
    expect(useTools.getState().focusedZone).toBe('right')

    close('image', 'right', 'primary')
    expect(useTools.getState().focusedZone).toBeNull()
  })

  it('clamps the divider between the two halves', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { right: { primary: 'layers', secondary: 'inspector' } },
      }),
    })
    useTools.getState().resplit('image', 'right', 900, 400)
    expect(arrangementOf(useTools.getState(), 'image').splits.right).toBe(400 - MIN_SPLIT)
  })
})

/**
 * The home and the six spaces use the same two columns — the projects and the journal on one
 * side, the Explorer and generation on the other. They never share the screen, so they must not
 * share an arrangement: every one of these was a real defect before it was split per family, and
 * each is a gesture on one surface silently rewriting the other.
 */
describe('the home and the workspaces arrange their zones apart', () => {
  beforeEach(() => {
    useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS, focusedZone: null })
  })

  it('does not close the generation column when the projects are closed on the home', () => {
    useTools.getState().close(HOME_SURFACE, 'left', 'secondary')

    expect(arrangementOf(useTools.getState(), HOME_SURFACE).open.left?.secondary).toBeUndefined()
    expect(arrangementOf(useTools.getState(), 'image').open.left).toEqual({
      primary: null,
      secondary: null,
    })
  })

  // The one that lost a setting: the space kept `generator`, the home wrote its own panel over
  // it, and `shownTool` then fell back to the Models panel for good.
  it('does not overwrite the panel a space named in the same column', () => {
    useTools.getState().show('image', 'left', 'generator')
    useTools.getState().show(HOME_SURFACE, 'left', 'projects')

    expect(arrangementOf(useTools.getState(), 'image').open.left).toEqual({
      primary: 'generator',
      secondary: null,
    })
    expect(arrangementOf(useTools.getState(), HOME_SURFACE).open.left).toEqual({
      secondary: 'projects',
    })
  })

  // The generator renders a model's own form; 320 is its width for that reason. A file tree
  // narrowed on the home has no business taking it with it.
  it('keeps the width of one column out of the other', () => {
    useTools.getState().resize(HOME_SURFACE, 'left', 170, 1000)

    expect(arrangementOf(useTools.getState(), HOME_SURFACE).sizes.left).toBe(170)
    expect(arrangementOf(useTools.getState(), 'image').sizes.left).toBeUndefined()
  })

  /**
   * The home draws a right column now, so its left one is bounded exactly as a space's is: both
   * have to leave the opposite column and the centre room. It was the one surface where a drag
   * could take the whole window, and that stopped being true when it gained its second column.
   */
  it('bounds each column against the other, on the home as in a space', () => {
    useTools.getState().resize(HOME_SURFACE, 'left', 700, 1000)
    useTools.getState().resize('image', 'left', 700, 1000)

    const bounded = 1000 - DEFAULT_SIZES.right - MIN_CENTER
    expect(arrangementOf(useTools.getState(), HOME_SURFACE).sizes.left).toBe(bounded)
    expect(arrangementOf(useTools.getState(), 'image').sizes.left).toBe(bounded)
  })

  it('re-clamps both families when the window shrinks', () => {
    useTools.getState().resize(HOME_SURFACE, 'left', 700, 1000)
    useTools.getState().resize('image', 'left', 600, 1400)

    useTools.getState().fit(600, 600)

    expect(arrangementOf(useTools.getState(), HOME_SURFACE).sizes.left).toBe(MIN_SIZE)
    expect(arrangementOf(useTools.getState(), 'image').sizes.left).toBe(MIN_SIZE)
  })
})

describe('migrating to the split arrangement', () => {
  // Everything version 8 stored was the workspaces': the home had no zones of its own to arrange.
  // Version 9 gave it one column; the default is two now, which is why the home is rebuilt rather
  // than read back at either version.
  it.each([8, 9])('reads a version %i layout as the workspaces, and defaults the home', version => {
    const migrated = migrateTools(
      { open: { right: { primary: 'layers' } }, sizes: { left: 400 } },
      version,
    )

    expect(migrated?.arrangements.workspaces.open.right).toEqual({ primary: 'layers' })
    expect(migrated?.arrangements.workspaces.sizes).toEqual({ left: 400 })
    expect(migrated?.arrangements.home).toEqual(DEFAULT_ARRANGEMENTS.home)
  })
})

describe('fitSplit', () => {
  it('leaves the other half something to live on', () => {
    expect(fitSplit(500, 400)).toBe(400 - MIN_SPLIT)
  })

  it('honours the minimum, even in a zone too short for two', () => {
    expect(fitSplit(10, 120)).toBe(MIN_SPLIT)
  })
})

describe('the default layout', () => {
  // What "Reset layout" in the native menu restores. It names no panel at all: naming one would
  // pick a section's answer — the layers, the shelf, the sky — and impose it on the other five.
  it('names which halves are open, and no panel in any of them', () => {
    for (const family of Object.values(DEFAULT_OPEN)) {
      for (const slots of Object.values(family)) {
        for (const tool of Object.values(slots)) expect(tool).toBeNull()
      }
    }
  })

  it('survives a round trip through the persisted shape', () => {
    expect(openFrom(DEFAULT_OPEN.workspaces)).toEqual(DEFAULT_OPEN.workspaces)
  })

  // Every half named a panel up to version 7, the default included. Kept as a choice, an Image
  // nobody had ever arranged would still open on the explorer instead of its layers.
  it('is what a layout from before version 8 comes back as, half for half', () => {
    const stored = openFrom({
      right: { primary: 'explorer', secondary: 'inspector' },
      bottom: { primary: 'assets' },
    })

    expect(unchosen(stored)).toEqual({
      right: { primary: null, secondary: null },
      bottom: { primary: null },
    })
  })

  it('leaves a closed half closed — it says which halves are open, and only that', () => {
    expect(unchosen({ right: { secondary: 'inspector' } })).toEqual({ right: { secondary: null } })
  })
})

describe('openFrom', () => {
  it('migrates the single id version 2 stored into the slot its tool declares', () => {
    expect(openFrom({ right: 'inspector' })).toEqual({ right: { secondary: 'inspector' } })
  })

  it('opens a tool in every zone it sits in, so changing workspace never hides it', () => {
    // The shelf lies in the bottom band nearly everywhere and stands in the right column in
    // Video and Audio. Stored in one, it has to be open in the other, or the workspace that
    // reads it elsewhere shows nothing where it belongs.
    expect(openFrom({ right: { primary: 'assets' } })).toEqual({
      right: { primary: 'assets' },
      bottom: { primary: 'assets' },
    })
  })

  it('lands a tool in the zone it declares today, not the one it was stored under', () => {
    // The generation panels held the upper right until version 6; they own the left column now.
    const open = openFrom({ right: { primary: 'generator' } })
    expect(open.right?.primary).toBeUndefined()
    expect(open.left?.primary).toBe('generator')
  })

  // The layout a version 6 install actually holds. Every half it named still draws a panel
  // afterwards: a migration that left one empty would look like a broken window on the first
  // launch after an update.
  it('rebuilds a whole version 6 layout without emptying a half', () => {
    const open = openFrom({
      left: { primary: 'assets', secondary: 'explorer' },
      right: { primary: 'models', secondary: 'inspector' },
      bottom: { primary: 'assets' },
    })

    // The Explorer keeps the lower left it was stored in — it is where it lives now too.
    expect(open.left).toEqual({ primary: 'models', secondary: 'explorer' })
    // The shelf takes the upper right the Explorer used to win: it declares that half in Video
    // and Audio, and nothing is left there to outrank it.
    expect(open.right).toEqual({ primary: 'assets', secondary: 'inspector' })
    expect(open.bottom).toEqual({ primary: 'assets' })
  })

  /**
   * A panel stored in a zone it no longer belongs to is moved to the one it declares, rather
   * than left where nothing would ever draw it. The Explorer used to stand in the upper right.
   */
  it('moves a panel out of a zone it no longer belongs to', () => {
    const open = openFrom({ right: { primary: 'explorer' } })

    expect(open.left).toEqual({ secondary: 'explorer' })
    // Emptied, not dropped: a zone the stored layout named at all keeps its size and its handle.
    expect(open.right).toEqual({})
  })

  // The shelf claims the upper right and the band both; the column was only left on its default.
  // An explicit choice outranks a default, whichever of the two the rebuild reads first.
  it('lets a named panel win a half left on its default', () => {
    expect(openFrom({ right: { primary: null }, bottom: { primary: 'assets' } })).toEqual({
      right: { primary: 'assets' },
      bottom: { primary: 'assets' },
    })
  })

  it('keeps a default half that no panel claims', () => {
    expect(openFrom({ right: { primary: null, secondary: 'inspector' } })).toEqual({
      right: { primary: null, secondary: 'inspector' },
    })
  })

  it('drops the jobs panel, which is no longer a tool window', () => {
    expect(openFrom({ bottom: { primary: 'assets', secondary: 'jobs' } }).bottom).toEqual({
      primary: 'assets',
    })
  })

  it('never leaves a second half in a horizontal band — a band is never cut', () => {
    const stored = { bottom: { primary: 'timeline', secondary: 'explorer' } }
    expect(openFrom(stored).bottom?.secondary).toBeUndefined()
    // The explorer is not lost with the half it was stored in: it goes back to the column.
    expect(openFrom(stored).left?.secondary).toBe('explorer')
  })

  it('reads its own shape back unchanged', () => {
    const stored = { right: { primary: 'layers', secondary: 'inspector' } }
    expect(openFrom(stored)).toEqual(stored)
  })

  it('drops an id no version knows any more', () => {
    expect(openFrom({ left: { primary: 'ghost' } })).toEqual({ left: {} })
    expect(openFrom({ left: 'ghost' })).toEqual({ left: {} })
  })

  it('falls back to the defaults when there is nothing to read', () => {
    expect(openFrom(null)).toBe(DEFAULT_OPEN.workspaces)
  })
})
