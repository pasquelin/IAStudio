import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_OPEN,
  fitZoneSize,
  fitSplit,
  MIN_CENTER,
  MIN_SIZE,
  MIN_SPLIT,
  openFrom,
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
    useTools.setState({ open: {}, sizes: {}, splits: {}, focusedZone: null })
  })

  it('clamps the stored size on resize', () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } } })
    useTools.getState().resize('bottom', 900, 800)
    expect(useTools.getState().sizes.bottom).toBe(800 - MIN_CENTER)
  })

  it('keeps the center alive when both sides are dragged wide', () => {
    useTools.setState({
      open: { left: { primary: 'generator' }, right: { primary: 'explorer' } },
    })
    const { resize } = useTools.getState()
    resize('left', 900, 1000)
    resize('right', 900, 1000)

    const { sizes } = useTools.getState()
    expect((sizes.left ?? 0) + (sizes.right ?? 0)).toBeLessThanOrEqual(1000 - MIN_CENTER)
  })

  it('re-clamps every zone when the window shrinks', () => {
    useTools.setState({ open: { left: { primary: 'models' } }, sizes: { left: 600 } })
    useTools.getState().fit(800, 600)
    expect(useTools.getState().sizes.left).toBe(800 - MIN_CENTER)
  })

  it('opens a tool in the half its placement declares', () => {
    useTools.getState().show('right', 'layers')
    expect(useTools.getState().open.right).toEqual({ primary: 'layers' })
  })

  it('leaves the other half alone, so both show at once', () => {
    const { show } = useTools.getState()
    show('right', 'inspector')
    show('right', 'layers')

    expect(useTools.getState().open.right).toEqual({ primary: 'layers', secondary: 'inspector' })
  })

  it('swaps within a half rather than stacking, when two tools share it', () => {
    const { show } = useTools.getState()
    show('left', 'generator')
    show('left', 'models')

    expect(useTools.getState().open.left).toEqual({ primary: 'models' })
  })

  it('empties the half it is asked to close', () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } } })
    useTools.getState().close('bottom', 'primary')
    expect(useTools.getState().open.bottom?.primary).toBeUndefined()
  })

  it('drops focus only once both halves are empty', () => {
    useTools.setState({
      open: { right: { primary: 'layers', secondary: 'inspector' } },
      focusedZone: 'right',
    })
    const { close } = useTools.getState()

    close('right', 'secondary')
    expect(useTools.getState().focusedZone).toBe('right')

    close('right', 'primary')
    expect(useTools.getState().focusedZone).toBeNull()
  })

  it('clamps the divider between the two halves', () => {
    useTools.setState({ open: { right: { primary: 'layers', secondary: 'inspector' } } })
    useTools.getState().resplit('right', 900, 400)
    expect(useTools.getState().splits.right).toBe(400 - MIN_SPLIT)
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

    expect(open.left).toEqual({ primary: 'models' })
    // Two tools of the old left column now declare the same half; the last one read wins it, and
    // the shelf is not lost with it — it keeps the band, which is its other placement.
    expect(open.right).toEqual({ primary: 'explorer', secondary: 'inspector' })
    expect(open.bottom).toEqual({ primary: 'assets' })
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
    expect(openFrom(stored).right?.primary).toBe('explorer')
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
    expect(openFrom(null)).toBe(DEFAULT_OPEN)
  })
})
