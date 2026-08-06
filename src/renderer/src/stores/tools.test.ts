import { beforeEach, describe, expect, it } from 'vitest'
import { clamp, MIN_CENTER, MIN_SIZE, useTools } from './tools'

describe('clamp', () => {
  it('leaves room for the documents area', () => {
    // 1000 wide, nothing opposite, 240 reserved for the center.
    expect(clamp(900, 1000, 0)).toBe(1000 - MIN_CENTER)
  })

  it('accounts for what the opposite zone already takes', () => {
    expect(clamp(900, 1000, 300)).toBe(1000 - 300 - MIN_CENTER)
  })

  it('honours the minimum size', () => {
    expect(clamp(10, 1000, 0)).toBe(MIN_SIZE)
  })

  it('lets an in-between size through, rounded', () => {
    expect(clamp(300.4, 1000, 0)).toBe(300)
  })

  it('never returns less than the minimum, even in a tiny window', () => {
    // Ceiling would be negative here; the floor must still win so the panel stays usable.
    expect(clamp(500, 200, 0)).toBe(MIN_SIZE)
  })
})

describe('tools store', () => {
  beforeEach(() => {
    useTools.setState({ open: {}, sizes: {}, collapsed: {}, focusedZone: null })
  })

  it('clamps the stored size on resize', () => {
    useTools.setState({ open: { bottom: 'assets' } })
    useTools.getState().resize('bottom', 900, 800)
    expect(useTools.getState().sizes.bottom).toBe(800 - MIN_CENTER)
  })

  it('keeps the center alive when both sides are dragged wide', () => {
    useTools.setState({ open: { left: 'explorer', right: 'generator' } })
    const { resize } = useTools.getState()
    resize('left', 900, 1000)
    resize('right', 900, 1000)

    const { sizes } = useTools.getState()
    expect((sizes.left ?? 0) + (sizes.right ?? 0)).toBeLessThanOrEqual(1000 - MIN_CENTER)
  })

  it('re-clamps every zone when the window shrinks', () => {
    useTools.setState({ open: { left: 'explorer' }, sizes: { left: 600 } })
    useTools.getState().fit(800, 600)
    expect(useTools.getState().sizes.left).toBe(800 - MIN_CENTER)
  })

  it('expands a collapsed zone when its icon is clicked again', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: { bottom: true } })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().collapsed.bottom).toBe(false)
    expect(useTools.getState().open.bottom).toBe('assets')
  })

  it('opens a different tool expanded, not collapsed', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: { bottom: true } })
    useTools.getState().toggle('bottom', 'jobs')
    expect(useTools.getState().open.bottom).toBe('jobs')
    expect(useTools.getState().collapsed.bottom).toBe(false)
  })

  it('closes the zone when an expanded tool icon is clicked again', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: {} })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().open.bottom).toBeNull()
  })

  it('does not let a closed panel come back collapsed', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: { bottom: true } })
    useTools.getState().close('bottom')
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().collapsed.bottom).toBe(false)
  })

  it('collapses and expands with the same action', () => {
    useTools.setState({ open: { left: 'explorer' }, collapsed: {} })
    const { collapse } = useTools.getState()
    collapse('left')
    expect(useTools.getState().collapsed.left).toBe(true)
    collapse('left')
    expect(useTools.getState().collapsed.left).toBe(false)
  })

  it('drops focus from the zone being closed', () => {
    useTools.setState({ open: { left: 'explorer' }, focusedZone: 'left' })
    useTools.getState().close('left')
    expect(useTools.getState().focusedZone).toBeNull()
  })
})
