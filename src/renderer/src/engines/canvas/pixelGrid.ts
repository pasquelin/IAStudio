import type { Point } from '../core/geometry'
import { sided, type Rect } from './canvasState'

// A CELL is one square of the artwork; `cell` is how many document pixels wide it is, and it
// always comes from `pixelCellOf` — nothing here guards a division by it.

export function cellOf(value: number, cell: number): number {
  return Math.floor(value / cell)
}

/** How many cells fit across a side. The last is clipped where `cell` does not divide it. */
export function cellsSpanning(size: number, cell: number): number {
  return Math.max(1, Math.ceil(size / cell))
}

/** The other way round: the cell a side has to be cut by to hold `wanted` of them. */
export function cellFor(size: number, wanted: number): number {
  return sided(size / wanted)
}

/** The square a dab stamps. Two points inside one cell give the same rectangle — that is the mode. */
export function stampRect(at: Point, cell: number, brushSize: number): Rect {
  const { across, back } = stampSpan(cell, brushSize)
  const column = cellOf(at.x, cell) - back
  const row = cellOf(at.y, cell) - back

  return { x: column * cell, y: row * cell, width: across * cell, height: across * cell }
}

/** The cell a document point falls in, as grid coordinates. */
export function cellAt(point: Point, cell: number): Point {
  return { x: cellOf(point.x, cell), y: cellOf(point.y, cell) }
}

/** How many cells a brush covers, and how many of them sit before the cell under the hand. */
function stampSpan(cell: number, brushSize: number): { across: number; back: number } {
  const across = sided(brushSize / cell)
  return { across, back: Math.floor((across - 1) / 2) }
}

/**
 * The squares of a line's cells merged into one rectangle per row. A square per cell overdrew
 * every fragment `across` times and composited a half-opaque stroke onto itself. Cells of ONE
 * line: a run is a hull, and a gap in a row would be filled.
 */
export function cellRuns(cells: readonly Point[], cell: number, brushSize: number): Rect[] {
  const { across, back } = stampSpan(cell, brushSize)
  const runs = new Map<number, { left: number; right: number }>()

  for (const at of cells) {
    const left = at.x - back
    for (let row = at.y - back; row < at.y - back + across; row += 1) {
      const run = runs.get(row)
      if (run) {
        run.left = Math.min(run.left, left)
        run.right = Math.max(run.right, left + across)
      } else runs.set(row, { left, right: left + across })
    }
  }
  return [...runs].map(([row, run]) => ({
    x: run.left * cell,
    y: row * cell,
    width: (run.right - run.left) * cell,
    height: cell,
  }))
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
