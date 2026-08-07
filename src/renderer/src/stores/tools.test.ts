import { beforeEach, describe, expect, it } from 'vitest'
import { fitZoneSize, fitSplit, MIN_CENTER, MIN_SIZE, MIN_SPLIT, openFrom, useTools } from './tools'

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
      open: { left: { secondary: 'explorer' }, right: { primary: 'generator' } },
    })
    const { resize } = useTools.getState()
    resize('left', 900, 1000)
    resize('right', 900, 1000)

    const { sizes } = useTools.getState()
    expect((sizes.left ?? 0) + (sizes.right ?? 0)).toBeLessThanOrEqual(1000 - MIN_CENTER)
  })

  it('re-clamps every zone when the window shrinks', () => {
    useTools.setState({ open: { left: { secondary: 'explorer' } }, sizes: { left: 600 } })
    useTools.getState().fit(800, 600)
    expect(useTools.getState().sizes.left).toBe(800 - MIN_CENTER)
  })

  it('opens a tool in the half its placement declares', () => {
    useTools.getState().toggle('left', 'layers')
    expect(useTools.getState().open.left).toEqual({ primary: 'layers' })
  })

  it('leaves the other half alone, so both show at once', () => {
    const { toggle } = useTools.getState()
    toggle('left', 'explorer')
    toggle('left', 'layers')

    expect(useTools.getState().open.left).toEqual({ primary: 'layers', secondary: 'explorer' })
  })

  it('swaps within a half rather than stacking, when two tools share it', () => {
    const { toggle } = useTools.getState()
    toggle('right', 'generator')
    toggle('right', 'models')

    expect(useTools.getState().open.right).toEqual({ primary: 'models' })
  })

  it('closes the half when the tool already up is clicked again', () => {
    useTools.setState({ open: { bottom: { primary: 'assets' } } })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().open.bottom?.primary).toBeUndefined()
  })

  it('drops focus only once both halves are empty', () => {
    useTools.setState({
      open: { left: { primary: 'layers', secondary: 'explorer' } },
      focusedZone: 'left',
    })
    const { close } = useTools.getState()

    close('left', 'secondary')
    expect(useTools.getState().focusedZone).toBe('left')

    close('left', 'primary')
    expect(useTools.getState().focusedZone).toBeNull()
  })

  it('clamps the divider between the two halves', () => {
    useTools.setState({ open: { left: { primary: 'layers', secondary: 'explorer' } } })
    useTools.getState().resplit('left', 900, 400)
    expect(useTools.getState().splits.left).toBe(400 - MIN_SPLIT)
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
    expect(openFrom({ left: 'explorer' })).toEqual({ left: { secondary: 'explorer' } })
  })

  it('opens a tool in every zone it sits in, so changing workspace never hides it', () => {
    // The shelf lies in the bottom strip nearly everywhere and stands on the right in Video
    // and Audio. Stored in one, it has to be open in the other, or the workspace that reads it
    // elsewhere shows nothing where it belongs.
    expect(openFrom({ right: { primary: 'assets' } })).toEqual({
      right: { primary: 'assets' },
      bottom: { primary: 'assets' },
    })
  })

  it('never displaces a tool an explicit layout already put there', () => {
    const stored = { right: { primary: 'assets' }, bottom: { primary: 'jobs' } }
    // `jobs` declares the secondary half today, so it lands there and leaves the primary free
    // for the shelf rather than being overwritten by it.
    expect(openFrom(stored)).toEqual({
      right: { primary: 'assets' },
      bottom: { primary: 'assets', secondary: 'jobs' },
    })
  })

  it('reads its own shape back unchanged', () => {
    const stored = { left: { primary: 'layers', secondary: 'explorer' } }
    expect(openFrom(stored)).toEqual(stored)
  })

  it('drops an id no version knows any more', () => {
    expect(openFrom({ left: { primary: 'ghost' } })).toEqual({ left: {} })
    expect(openFrom({ left: 'ghost' })).toEqual({ left: {} })
  })

  it('falls back to the defaults when there is nothing to read', () => {
    expect(openFrom(null).left).toEqual({ secondary: 'explorer' })
  })
})
