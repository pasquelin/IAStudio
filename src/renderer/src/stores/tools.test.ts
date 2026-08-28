import { beforeEach, describe, expect, it } from 'vitest'
import { shownTools, type ToolState } from '@/helpers/toolRegistry'
import { arrangedFor } from './tool-fixtures'
import {
  familyOf,
  HOME_SURFACE,
  SURFACE_FAMILIES,
  TOOL_PLACEMENTS,
  TOOL_SLOTS,
  TOOL_ZONES,
  type SurfaceFamily,
} from '@shared/domain/tool'
import {
  arrangementOf,
  DEFAULT_ARRANGEMENTS,
  DEFAULT_LENGTHS,
  DEFAULT_OPEN,
  DEFAULT_SIZES,
  defaultSizeOf,
  migrateTools,
  fitZoneSize,
  fitSplit,
  MIN_CENTER,
  MIN_SIZE,
  MIN_SPLIT,
  openFrom,
  unchosen,
  useTools,
  type OpenByZone,
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
      arrangements: arrangedFor('image', { open: {} }),
      lengths: DEFAULT_LENGTHS,
      focusedZone: null,
    })
  })

  it('clamps the stored size on resize', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottomRight: { primary: 'assets' } } }),
    })
    useTools.getState().resize('bottomRight', 900, 800)
    expect(useTools.getState().lengths.sizes.bottomRight).toBe(800 - MIN_CENTER)
  })

  /** One strip, one height: dragged by either half, the other rises with it or steps. */
  it('gives both halves of the band the same height', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottomRight: { primary: 'assets' } } }),
    })
    useTools.getState().resize('bottomLeft', 300, 800)

    expect(useTools.getState().lengths.sizes.bottomRight).toBe(300)
    expect(useTools.getState().lengths.sizes.bottomLeft).toBeUndefined()
  })

  it('parts the band where the handle is dragged, and never past a usable half', () => {
    useTools.getState().resplitBand(620, 900)
    expect(useTools.getState().lengths.bandSplit).toBe(620)

    useTools.getState().resplitBand(890, 900)
    expect(useTools.getState().lengths.bandSplit).toBe(900 - MIN_SPLIT)
  })

  it('keeps the center alive when both sides are dragged wide', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { left: { primary: 'generator' }, right: { primary: 'explorer' } },
      }),
    })
    const { resize } = useTools.getState()
    resize('left', 900, 1000)
    resize('right', 900, 1000)

    const { sizes } = useTools.getState().lengths
    expect((sizes.left ?? 0) + (sizes.right ?? 0)).toBeLessThanOrEqual(1000 - MIN_CENTER)
  })

  /** A zone open anywhere takes its width off the others, whichever family holds it open. */
  it('re-clamps every zone when the window shrinks', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { left: { primary: 'assets' }, right: { primary: 'inspector' } },
      }),
      lengths: { sizes: { left: 600 }, splits: {} },
    })
    useTools.getState().fit(800, 600)
    expect(useTools.getState().lengths.sizes.left).toBe(800 - DEFAULT_SIZES.right - MIN_CENTER)
  })

  /**
   * A length is clamped against the TIGHTEST of the two families now that one serves both: a
   * width the home could afford — its left column being the only one it opens — would overflow
   * a space that keeps the opposite column open.
   */
  it('clamps a width against a column the other family keeps open', () => {
    useTools.setState({
      arrangements: {
        workspaces: { open: { right: { primary: 'inspector' } } },
        home: { open: { left: { primary: 'projects' } } },
      },
      lengths: { sizes: { right: 400 }, splits: {} },
    })
    useTools.getState().resize('left', 900, 1000)

    expect(useTools.getState().lengths.sizes.left).toBe(1000 - 400 - MIN_CENTER)
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
    show('image', 'left', 'assets')

    expect(arrangementOf(useTools.getState(), 'image').open.left).toEqual({ primary: 'assets' })
  })

  it('empties the half it is asked to close', () => {
    useTools.setState({
      arrangements: arrangedFor('image', { open: { bottomRight: { primary: 'assets' } } }),
    })
    useTools.getState().close('image', 'bottomRight', 'primary')
    expect(arrangementOf(useTools.getState(), 'image').open.bottomRight?.primary).toBeUndefined()
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

  /**
   * The right column belongs to the assistant while it is up, and gives itself back after.
   *
   * A conversation read in half a column is a conversation nobody holds, so the panel declares
   * `solo` and the store puts the column away rather than sharing it — then restores exactly what
   * it put away, since anything else would be the studio's default, not the reader's.
   */
  describe('a panel that takes its zone whole', () => {
    it('puts the other half away, and gives it back on closing', () => {
      useTools.setState({
        arrangements: arrangedFor('image', {
          open: { right: { primary: 'layers', secondary: 'inspector' } },
        }),
      })
      const { show, close } = useTools.getState()

      show('image', 'right', 'assistant')
      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
        primary: 'assistant',
      })

      close('image', 'right', 'primary')
      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
        primary: 'layers',
        secondary: 'inspector',
      })
    })

    /**
     * Asking for another panel is a CHOICE, and restoring over it would undo the very gesture
     * that was just made. The column comes back, and what was asked for stands in it.
     */
    it('gives the column back around the panel asked for, rather than over it', () => {
      useTools.setState({
        arrangements: arrangedFor('image', {
          open: { right: { primary: 'layers', secondary: 'inspector' } },
        }),
      })
      const { show } = useTools.getState()

      show('image', 'right', 'assistant')
      show('image', 'right', 'text')

      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
        primary: 'text',
        secondary: 'inspector',
      })
    })

    /**
     * The column nobody arranged: the assistant is what an untouched right half draws, so there
     * is nothing stashed to give back. The half falls to the first panel that SHARES the zone —
     * without it, an unnamed half would answer with the assistant again and swallow the gesture.
     */
    it('falls to the panel behind it where nothing was ever put away', () => {
      useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })

      useTools.getState().show('image', 'right', 'inspector')

      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
        primary: 'layers',
        secondary: 'inspector',
      })
    })

    /**
     * 🛑 The half the solo panel SILENCES is not a half it closed: rebuilding the column from the
     * shared panel alone shut the inspector every time a rail icon of the upper half was clicked.
     */
    it('keeps the silenced half when the reader asks for another panel beside it', () => {
      useTools.setState({ arrangements: DEFAULT_ARRANGEMENTS })

      useTools.getState().show('image', 'right', 'layers')

      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
        primary: 'layers',
        secondary: null,
      })
    })

    /**
     * 🛑 It closes THAT HALF, never the column: the half beside it may hold a panel the reader
     * chose while the assistant was withheld, and closing the assistant took it down with it.
     */
    it('closes only the half it was asked to, where nothing was put away', () => {
      useTools.setState({
        arrangements: arrangedFor('image', { open: { right: { secondary: 'inspector' } } }),
      })

      useTools.getState().close('image', 'right', 'primary')

      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({
        secondary: 'inspector',
      })
    })

    /**
     * 🛑 A reset that left the stash behind gave the column back on the next close — undoing,
     * silently, the very reset that had just cleared it.
     */
    it('forgets what it put away when the layout is reset', () => {
      useTools.setState({
        arrangements: arrangedFor('image', {
          open: { right: { primary: 'layers', secondary: 'inspector' } },
        }),
      })
      useTools.getState().show('image', 'right', 'assistant')

      useTools.getState().reset()
      useTools.getState().close('image', 'right', 'primary')

      expect(arrangementOf(useTools.getState(), 'image').open.right).toEqual({ secondary: null })
    })
  })

  it('clamps the divider between the two halves', () => {
    useTools.setState({
      arrangements: arrangedFor('image', {
        open: { right: { primary: 'layers', secondary: 'inspector' } },
      }),
    })
    useTools.getState().resplit('right', 900, 400)
    expect(useTools.getState().lengths.splits.right).toBe(400 - MIN_SPLIT)
  })
})

/**
 * A conversation at 260 wraps every sentence onto three lines, and the layer stack at 460 is
 * mostly gutter — so the width belongs to the TOOL, until somebody drags one.
 */
describe('a tool that opens its zone wider than the zone would', () => {
  it('opens at its own width, where its neighbours keep the zone width', () => {
    expect(defaultSizeOf('right', 'assistant')).toBe(460)
    expect(defaultSizeOf('right', 'layers')).toBe(DEFAULT_SIZES.right)
    expect(defaultSizeOf('right', null)).toBe(DEFAULT_SIZES.right)
  })

  /**
   * 🛑 The clamp reads the same number, or the opposite column may be dragged over room this one
   * is already drawing in — and the centre goes under its floor with nothing on screen saying so.
   */
  it('is the room the opposite column is bounded against', () => {
    useTools.setState({
      arrangements: arrangedFor('home', {
        open: { left: { primary: 'projects' }, right: { primary: 'assistant' } },
      }),
      lengths: { sizes: {}, splits: {} },
    })

    useTools.getState().resize('left', 900, 1400)

    expect(useTools.getState().lengths.sizes.left).toBe(1400 - 460 - MIN_CENTER)
  })
})

/**
 * `DEFAULT_OPEN` is a second copy of what `TOOL_PLACEMENTS` already says, kept by hand — and the
 * home's upper left has been named, unnamed and named again in three versions, once per panel
 * that moved through it. Nothing crossed the two until this test.
 *
 * Both directions cost something real. A half a surface HAS but does not name starts closed: the
 * panel is drawn nowhere, and only the rail leads back to it. A half it names but does not have
 * reports the zone open to `isZoneOpen`, which reads the key rather than what it resolves to —
 * the column reserves its 320 px against the opposite one long after the screen stopped drawing
 * it.
 */
describe('the halves a surface starts on', () => {
  const halvesOfFamily = (family: SurfaceFamily): string[] =>
    [
      ...new Set(
        TOOL_PLACEMENTS.filter(placement =>
          placement.surfaces.some(surface => familyOf(surface) === family),
        ).map(placement => `${placement.zone}:${placement.slot}`),
      ),
    ].sort()

  const halvesNamedBy = (open: OpenByZone): string[] =>
    TOOL_ZONES.flatMap(zone =>
      TOOL_SLOTS.filter(slot => open[zone] && slot in open[zone]).map(slot => `${zone}:${slot}`),
    ).sort()

  it.each(SURFACE_FAMILIES)('names every half %s has, and no other', family => {
    expect(halvesNamedBy(DEFAULT_OPEN[family])).toEqual(halvesOfFamily(family))
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

  it('does not close the generation column when the home closes its lower left', () => {
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
    // The home's left column has both halves too, the lower one holding the project as a folder.
    expect(arrangementOf(useTools.getState(), HOME_SURFACE).open.left).toEqual({
      primary: 'projects',
      secondary: null,
    })
  })

  /**
   * A column dragged on the home is the SAME column in a space, and the reverse was the defect:
   * the width sat beside what each half holds, so crossing to the home changed it for no reason
   * anyone had chosen. What stays per family is which panels are up, which is what the split of
   * version 8 was ever about.
   */
  it('carries one width across the home and the spaces', () => {
    useTools.getState().resize('left', 170, 1000)

    expect(useTools.getState().lengths.sizes.left).toBe(170)
  })

  /**
   * Both columns are bounded against each other, on either surface: the home draws a right
   * column too, and a drag there could once take the whole window.
   */
  it('bounds each column against the other', () => {
    useTools.getState().resize('left', 700, 1000)

    expect(useTools.getState().lengths.sizes.left).toBe(1000 - DEFAULT_SIZES.right - MIN_CENTER)
  })

  it('re-clamps the studio when the window shrinks', () => {
    useTools.getState().resize('left', 700, 1000)

    useTools.getState().fit(600, 600)

    expect(useTools.getState().lengths.sizes.left).toBe(MIN_SIZE)
  })
})

/** The home with a project open: the assistant asks for a centre holding anything but the thread,
 * and the home page IS that. */
const IN_HOME: ToolState = {
  hasProject: true,
  hasGit: true,
  hasCloud: true,
  centreTaken: true,
}

describe('migrating to the split arrangement', () => {
  // Everything version 8 stored was the workspaces': one arrangement, flat at the root, since the
  // home had no zones of its own to arrange.
  it('reads a version 8 layout as the workspaces, and defaults the home', () => {
    const migrated = migrateTools(
      { open: { right: { primary: 'layers' } }, sizes: { left: 400 } },
      8,
    )

    expect(migrated?.arrangements.workspaces.open.right).toEqual({ primary: 'layers' })
    expect(migrated?.lengths.sizes).toEqual({ left: 400 })
    expect(migrated?.arrangements.home).toEqual(DEFAULT_ARRANGEMENTS.home)
  })

  /**
   * The shape versions 9 and 10 actually wrote — `partialize` has published `arrangements` since
   * the split. Read as the flat one, none of `open`, `sizes` and `splits` is found, and every
   * column width and chosen panel of all seven spaces goes back to the factory without a word.
   * That is what a bump meant to add a half to the home would have cost.
   */
  it.each([9, 10, 11, 12])('keeps what version %i wrote under `arrangements`', version => {
    const migrated = migrateTools(
      {
        arrangements: {
          workspaces: { open: { right: { primary: 'layers' } }, sizes: { left: 400 }, splits: {} },
          home: { open: { left: { secondary: 'projects' } }, sizes: {}, splits: {} },
        },
      },
      version,
    )

    expect(migrated?.arrangements.workspaces.open.right).toEqual({ primary: 'layers' })
    expect(migrated?.lengths.sizes).toEqual({ left: 400 })
    // The home is the one this bump changes: it starts on both halves of both columns.
    expect(migrated?.arrangements.home).toEqual(DEFAULT_ARRANGEMENTS.home)
  })

  /**
   * 🛑 A `ToolId` ARRIVING costs a bump exactly as one leaving does, and this is the case that
   * proves it: version 19 knew no right column on the home, so an arrangement written by it names
   * the halves it had and no others. Left unmigrated, the zone reads as one nobody opened — the
   * assistant would be reachable from the home by ⌘K alone, for ever, on every installed profile.
   */
  it('opens the home on the assistant, which a version 19 arrangement cannot name', () => {
    const migrated = migrateTools(
      {
        arrangements: {
          workspaces: { open: { right: { primary: 'layers' } } },
          home: {
            open: { left: { primary: null, secondary: null }, bottomRight: { primary: null } },
          },
        },
      },
      19,
    )

    expect(migrated?.arrangements.home.open.right).toEqual({ primary: null })
    expect(
      shownTools(migrated?.arrangements.home.open.right, 'right', HOME_SURFACE, IN_HOME),
    ).toMatchObject({ primary: 'assistant' })
  })

  /**
   * The band was ONE zone up to version 14. Dropped as an unknown key, the panel it held would
   * come back closed and the height it was dragged to would go back to the factory's.
   */
  it('lands a version 14 band on the right half, height and all', () => {
    const migrated = migrateTools(
      {
        arrangements: {
          workspaces: { open: { bottom: { primary: 'timeline' } }, sizes: { bottom: 400 } },
        },
      },
      14,
    )

    expect(migrated?.arrangements.workspaces.open.bottomRight).toEqual({ primary: 'timeline' })
    expect(migrated?.lengths.sizes.bottomRight).toBe(400)
  })

  /**
   * The montage above, and the shelf here, because the two answer differently now: a version 14
   * band holding the SHELF comes back with the half open and empty, the shelf having moved to
   * the left column on 17 August. The height is kept all the same — the zone is still there.
   */
  it('empties a version 14 band that held the shelf, keeping the half and its height', () => {
    const migrated = migrateTools(
      {
        arrangements: {
          workspaces: { open: { bottom: { primary: 'assets' } }, sizes: { bottom: 400 } },
        },
      },
      14,
    )

    expect(migrated?.arrangements.workspaces.open.bottomRight).toEqual({})
    expect(migrated?.arrangements.workspaces.open.left).toEqual({ primary: 'assets' })
    expect(migrated?.lengths.sizes.bottomRight).toBe(400)
  })

  /**
   * What a stored `channels` comes back as, the panel having become a section of the inspector.
   *
   * **This does not hold the version bump beside it**, and nothing here can: whether `migrate`
   * runs at all is zustand's contract with `version`, not ours. What it holds is the half of the
   * answer that IS ours — that the migration knows to unhang a panel no placement declares.
   */
  it('unhangs a panel a stored layout named and the registry has dropped', () => {
    const migrated = migrateTools(
      { arrangements: { workspaces: { open: { right: { primary: 'channels' } } } } },
      16,
    )

    expect(migrated?.arrangements.workspaces.open.right).toEqual({})
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
    const named = Object.values(DEFAULT_OPEN).flatMap(family =>
      Object.values(family).flatMap(slots => Object.values(slots)),
    )

    // The anchor: an empty table satisfies "no panel is named" without opening anything at all.
    expect(named.length).toBeGreaterThan(0)
    for (const tool of named) expect(tool).toBeNull()
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

    // The band comes back with no half at all: the shelf it named moved to the left column on
    // 17 August, and a zone emptied that way takes no room rather than standing blank.
    //
    // The Explorer stored in the upper right does not reach the left column, and that is
    // `slotsFrom` rather than this: two panels stored in one zone that both declare the SAME
    // half leave one of them behind, the last read winning. Unchanged by the move, and written
    // down here because the expectation looks like a loss and is not a new one.
    expect(unchosen(stored)).toEqual({
      left: { primary: null },
      right: { secondary: null },
      bottomRight: {},
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

  /**
   * The shelf stood in the right column of Video and Audio until 17 August, and lay in the band
   * everywhere else. It declares one half now — the upper left — so a layout stored under either
   * of the old two comes back under the new one. This is the migration every existing install
   * runs, which is why it is written out rather than left to the generic case below.
   */
  it('brings a shelf stored in the right column back to the left', () => {
    expect(openFrom({ right: { primary: 'assets' } })).toEqual({
      right: {},
      left: { primary: 'assets' },
    })
  })

  it('lands a tool in the zone it declares today, not the one it was stored under', () => {
    // The generation panels held the upper right until version 6; they own the left column now.
    const open = openFrom({ right: { primary: 'generator' } })
    expect(open.right?.primary).toBeUndefined()
    expect(open.left?.primary).toBe('generator')
  })

  /**
   * The layout a version 6 install actually holds. Nothing it named is LOST — every panel comes
   * back in the half it declares today — but two zones do come back empty, and that is the
   * shelf moving to the left column: it was what filled the band, and what the upper right held
   * in Video and Audio. An emptied zone takes no room, so what the reader sees is a window with
   * one column fewer, not a blank rectangle.
   */
  it('rebuilds a whole version 6 layout, losing no panel', () => {
    const open = openFrom({
      left: { primary: 'assets', secondary: 'explorer' },
      right: { primary: 'assets', secondary: 'inspector' },
      bottom: { primary: 'assets' },
    })

    // The shelf holds the upper left it was stored in, and the models lose it: `??=` leaves the
    // first claim standing, and the left column is read before the right.
    expect(open.left).toEqual({ primary: 'assets', secondary: 'explorer' })
    expect(open.right).toEqual({ secondary: 'inspector' })
    // The band it was stored in is the band's RIGHT half today, and it comes back empty.
    expect(open.bottomRight).toEqual({})
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

  /**
   * A panel the studio no longer has at all — `documents`, whose flat list the project folder
   * replaced on 17 August. Dropped where it stood, and the rest of the arrangement restored
   * whole: nothing here is bumped, nothing is migrated, and no other half pays for it.
   *
   * This is what says the version above may stay where it is when a panel goes: a bump would
   * hand the whole installed base its factory layout back for one icon.
   */
  it('drops a panel no version knows any more, and keeps the rest', () => {
    const open = openFrom({
      left: { primary: 'assets' },
      right: { primary: 'documents', secondary: 'inspector' },
    })

    expect(open.left).toEqual({ primary: 'assets' })
    // The half is emptied rather than dropped: it keeps its size and its handle.
    expect(open.right).toEqual({ secondary: 'inspector' })
  })

  // The upper left was only left on its default; the shelf stored in the band claims it. An
  // explicit choice outranks a default, whichever of the two the rebuild reads first.
  it('lets a named panel win a half left on its default', () => {
    expect(openFrom({ left: { primary: null }, bottom: { primary: 'assets' } })).toEqual({
      left: { primary: 'assets' },
      bottomRight: {},
    })
  })

  it('keeps a default half that no panel claims', () => {
    expect(openFrom({ right: { primary: null, secondary: 'inspector' } })).toEqual({
      right: { primary: null, secondary: 'inspector' },
    })
  })

  it('drops the jobs panel, which is no longer a tool window', () => {
    expect(openFrom({ bottom: { primary: 'history', secondary: 'jobs' } }).bottomRight).toEqual({
      primary: 'history',
    })
  })

  it('never leaves a second half in a horizontal band — a band is never cut', () => {
    const stored = { bottom: { primary: 'timeline', secondary: 'explorer' } }
    expect(openFrom(stored).bottomRight?.secondary).toBeUndefined()
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
