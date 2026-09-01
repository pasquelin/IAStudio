import { describe, expect, it } from 'vitest'
import { cellsOfLine, cellsSpanning, gridIsLegible, stampRect } from './pixelGrid'

describe('stampRect', () => {
  it('gives one rectangle for every point inside the same cell', () => {
    const corner = stampRect({ x: 32, y: 32 }, 16, 16)

    expect(stampRect({ x: 47.9, y: 32.1 }, 16, 16)).toEqual(corner)
    expect(corner).toEqual({ x: 32, y: 32, width: 16, height: 16 })
    expect(stampRect({ x: 48, y: 32 }, 16, 16)).not.toEqual(corner)
  })

  it('centres an odd brush on the pointer, and grows an even one forwards', () => {
    expect(stampRect({ x: 50, y: 50 }, 10, 30)).toEqual({ x: 40, y: 40, width: 30, height: 30 })
    expect(stampRect({ x: 50, y: 50 }, 10, 20)).toEqual({ x: 50, y: 50, width: 20, height: 20 })
  })

  it('never shrinks a brush below the one cell that always marks', () => {
    expect(stampRect({ x: 0, y: 0 }, 16, 1)).toEqual({ x: 0, y: 0, width: 16, height: 16 })
  })
})

describe('cellsOfLine', () => {
  // Symmetric on a 45° diagonal and NOT in general — a shallow slope walked backwards gives a
  // different staircase, which is Bresenham and not a defect.
  it('walks a diagonal with neither a gap nor a cell twice', () => {
    const cells = cellsOfLine({ x: 0, y: 0 }, { x: 4, y: 4 })

    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ])
    expect(cellsOfLine({ x: 4, y: 4 }, { x: 0, y: 0 })).toEqual([...cells].reverse())
  })

  it('steps once per column on a shallow slope', () => {
    expect(cellsOfLine({ x: 0, y: 0 }, { x: 4, y: 1 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ])
  })

  it('answers a single cell for a line that goes nowhere', () => {
    expect(cellsOfLine({ x: 7, y: 3 }, { x: 7, y: 3 })).toEqual([{ x: 7, y: 3 }])
  })

  // Both would walk forever: `NaN` loses every comparison, and a billion cells holds the frame.
  it('refuses ends no document can hold rather than walking them', () => {
    expect(cellsOfLine({ x: 0, y: 0 }, { x: Number.NaN, y: 0 })).toEqual([])
    expect(cellsOfLine({ x: 0, y: 0 }, { x: 1e9, y: 0 })).toEqual([])
  })
})

describe('cellsSpanning', () => {
  it('counts a partial last column in, since it is still a cell one can paint', () => {
    expect(cellsSpanning(1024, 16)).toBe(64)
    expect(cellsSpanning(1000, 16)).toBe(63)
  })
})

describe('gridIsLegible', () => {
  it('gives up before the lines close into a wash', () => {
    expect(gridIsLegible(1, 6)).toBe(true)
    expect(gridIsLegible(1, 4)).toBe(false)
  })
})
