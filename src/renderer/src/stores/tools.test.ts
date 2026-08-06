import { beforeEach, describe, expect, it } from 'vitest'
import { clamp, MAX_SHARE, MIN_SIZE, useTools } from './tools'

describe('clamp', () => {
  it('never lets a zone exceed half its container', () => {
    expect(clamp(900, 1000)).toBe(500)
    expect(clamp(1000, 400)).toBe(200)
  })

  it('honours the minimum size', () => {
    expect(clamp(10, 1000)).toBe(MIN_SIZE)
  })

  it('lets an in-between size through, rounded', () => {
    expect(clamp(300.4, 1000)).toBe(300)
  })

  it('lets the ceiling win over the floor when the window is tiny', () => {
    // On 200 px of height, half is 100: less than MIN_SIZE, and it must still win —
    // otherwise the panel would overflow its container.
    expect(clamp(500, 200)).toBe(200 * MAX_SHARE)
  })
})

describe('tools store', () => {
  beforeEach(() => {
    useTools.setState({ sizes: {}, collapsed: {}, focusedZone: null })
  })

  it('clamps the stored size on resize', () => {
    useTools.getState().resize('bottom', 900, 800)
    expect(useTools.getState().sizes.bottom).toBe(400)
  })

  it('expands a collapsed zone when its icon is clicked again', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: { bottom: true } })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().collapsed.bottom).toBe(false)
    expect(useTools.getState().open.bottom).toBe('assets')
  })

  it('closes the zone when an expanded tool icon is clicked again', () => {
    useTools.setState({ open: { bottom: 'assets' }, collapsed: {} })
    useTools.getState().toggle('bottom', 'assets')
    expect(useTools.getState().open.bottom).toBeNull()
  })

  it('drops focus from the zone being closed', () => {
    useTools.setState({ open: { left: 'explorer' }, focusedZone: 'left' })
    useTools.getState().close('left')
    expect(useTools.getState().focusedZone).toBeNull()
  })
})
