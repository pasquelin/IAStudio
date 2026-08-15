/**
 * What a montage and a scene's animation have in common: rows of their own heights, stacked down
 * one time axis.
 *
 * Nothing here knows what a row HOLDS — clips that take turns, or keys that add up. It is the
 * part both bands derive positions from, so a ruler, a hit test and a header column never each
 * cumulate their own offsets and drift apart.
 */
import type { Us } from '@shared/domain/time'

/** The only thing a row must say about itself for the stack to be laid out. */
export type Sized = { height: number }

export type Placed<T> = {
  item: T
  /** Distance from the top of the first row, before the ruler and the scroll are applied. */
  offset: number
}

export function placeRows<T extends Sized>(rows: readonly T[]): Placed<T>[] {
  const placed: Placed<T>[] = []
  let offset = 0
  for (const item of rows) {
    placed.push({ item, offset })
    offset += item.height
  }
  return placed
}

export function rowsHeight(rows: readonly Sized[]): number {
  return rows.reduce((total, row) => total + row.height, 0)
}

/** The row a distance from the top of the stack falls in, or nothing past the last one. */
export function rowAtOffset<T extends Sized>(rows: readonly T[], from: number): Placed<T> | null {
  if (from < 0) return null

  for (const placed of placeRows(rows)) {
    if (from < placed.offset + placed.item.height) return placed
  }
  return null
}

/**
 * How far right the view may go: far enough to bring the end of the band to the middle of the
 * strip, and no further — scrolling into unbounded emptiness loses the content off the left edge.
 */
export function maxOffsetFor(duration: Us, scale: number, width: number): Us {
  const span = Math.round(width / scale)
  return Math.max(0, duration - Math.round(span / 2))
}

export function maxScrollTopFor(content: number, height: number, rulerHeight: number): number {
  return Math.max(0, content - (height - rulerHeight))
}
