import type { Point } from '../core/geometry'
import type { Rect } from './canvasState'

// A CELL is one square of the artwork; `cell` is how many document pixels wide it is, and it
// always comes from `pixelCellOf` — nothing here guards a division by it.

export function cellOf(value: number, cell: number): number {
  return Math.floor(value / cell)
}

/** How many cells fit across a side. The last is clipped where `cell` does not divide it. */
export function cellsSpanning(size: number, cell: number): number {
  return Math.max(1, Math.ceil(size / cell))
}

/** The square a dab stamps. Two points inside one cell give the same rectangle — that is the mode. */
export function stampRect(at: Point, cell: number, brushSize: number): Rect {
  const across = Math.max(1, Math.round(brushSize / cell))
  const back = Math.floor((across - 1) / 2)
  const column = cellOf(at.x, cell) - back
  const row = cellOf(at.y, cell) - back

  return { x: column * cell, y: row * cell, width: across * cell, height: across * cell }
}

/** Twice the longest side a document may have, so no legitimate stroke ever reaches it. */
const MAX_LINE_CELLS = 16384

/**
 * Bresenham between two cells, both ends included: neither a gap nor a cell twice, which an
 * interpolation by distance cannot promise. Empty for ends no document can hold.
 */
export function cellsOfLine(fromCell: Point, toCell: Point): readonly Point[] {
  const toX = Math.round(toCell.x)
  const toY = Math.round(toCell.y)
  let x = Math.round(fromCell.x)
  let y = Math.round(fromCell.y)

  const spanX = Math.abs(toX - x)
  const spanY = Math.abs(toY - y)
  // `NaN` loses every comparison the walk makes, so it would never reach its end — refused here
  // rather than left to hang the renderer.
  const span = Math.max(spanX, spanY)
  if (!Number.isFinite(span) || span >= MAX_LINE_CELLS) return []

  const towardsX = x < toX ? 1 : -1
  const towardsY = y < toY ? 1 : -1
  const cells: Point[] = [{ x, y }]
  let error = spanX - spanY

  while (x !== toX || y !== toY) {
    const doubled = error * 2
    if (doubled > -spanY) {
      error -= spanY
      x += towardsX
    }
    if (doubled < spanX) {
      error += spanX
      y += towardsY
    }
    cells.push({ x, y })
  }
  return cells
}

/** Under this a hairline covers a sixth of the gap, and the grid reads as a grey wash. */
export const MIN_GRID_PX = 6

export function gridIsLegible(step: number, scale: number): boolean {
  return step * scale >= MIN_GRID_PX
}
