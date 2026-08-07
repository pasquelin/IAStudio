import { describe, expect, it } from 'vitest'
import { pointerNdc, type Bounds } from './pointer'

const BOUNDS: Bounds = { left: 100, top: 50, width: 200, height: 100 }

describe('pointer to device coordinates', () => {
  it('puts the centre at the origin', () => {
    expect(pointerNdc({ clientX: 200, clientY: 100 }, BOUNDS)).toEqual({ x: 0, y: 0 })
  })

  it('puts the top-left corner at (-1, +1) — y grows upwards, unlike the DOM', () => {
    expect(pointerNdc({ clientX: 100, clientY: 50 }, BOUNDS)).toEqual({ x: -1, y: 1 })
  })

  it('puts the bottom-right corner at (+1, -1)', () => {
    expect(pointerNdc({ clientX: 300, clientY: 150 }, BOUNDS)).toEqual({ x: 1, y: -1 })
  })

  it('accounts for the element offset rather than the window', () => {
    expect(pointerNdc({ clientX: 150, clientY: 75 }, BOUNDS)).toEqual({ x: -0.5, y: 0.5 })
  })

  it('reports nothing for a collapsed element, instead of dividing by zero', () => {
    expect(pointerNdc({ clientX: 10, clientY: 10 }, { ...BOUNDS, width: 0 })).toBeNull()
    expect(pointerNdc({ clientX: 10, clientY: 10 }, { ...BOUNDS, height: 0 })).toBeNull()
  })
})
