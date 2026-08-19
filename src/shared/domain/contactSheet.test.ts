import { describe, expect, it } from 'vitest'
import { contactSheetPages, sheetLayout, type SheetPicture } from './contactSheet'
import { A4_POINTS } from './pdf'

const picture = (caption: string, width = 100, height = 100): SheetPicture => ({
  caption,
  width,
  height,
  jpeg: new Uint8Array([1, 2, 3]),
})

const many = (count: number): SheetPicture[] =>
  Array.from({ length: count }, (_unused, at) => picture(`Plan ${at + 1}`))

describe('a contact sheet', () => {
  /** A sheet of nothing is a blank page, which is worse than no file at all. */
  it('makes no page at all for no pictures', () => {
    expect(contactSheetPages([], 4)).toEqual([])
  })

  it('lays the pictures out in the number of columns it was asked for', () => {
    const [page] = contactSheetPages(many(4), 4)

    const lefts = page?.places.map(place => Math.round(place.x)) ?? []
    expect(new Set(lefts).size).toBe(4)
    // One row: every cell sits at the same height.
    expect(new Set(page?.places.map(place => Math.round(place.y))).size).toBe(1)
  })

  /** Reading order, and PDF counts from the BOTTOM: the first row has to be the highest. */
  it('puts the first row above the second', () => {
    const [page] = contactSheetPages(many(4), 2)

    const [first] = page?.places ?? []
    const third = page?.places[2]
    expect(first?.y ?? 0).toBeGreaterThan(third?.y ?? 0)
  })

  it('runs on to a second page once one is full', () => {
    const { columns, rows } = sheetLayout(4)

    const pages = contactSheetPages(many(columns * rows + 1), 4)

    expect(pages).toHaveLength(2)
    expect(pages[1]?.places).toHaveLength(1)
  })

  /** The index has to keep counting ACROSS pages, or page two draws page one's pictures. */
  it('names each picture by its place in the whole set, not in its page', () => {
    const { columns, rows } = sheetLayout(4)

    const pages = contactSheetPages(many(columns * rows + 1), 4)

    expect(pages[1]?.places[0]?.image).toBe(columns * rows)
  })

  /**
   * A generation is any shape, and cropping one to a square on a sheet whose whole point is
   * choosing would hide what is being chosen.
   */
  it('fits a wide picture inside its cell rather than filling it', () => {
    const [page] = contactSheetPages([picture('Large', 200, 50)], 4)

    const [place] = page?.places ?? []
    expect((place?.width ?? 0) / (place?.height ?? 1)).toBeCloseTo(4, 2)
  })

  it('writes the name under each picture', () => {
    const [page] = contactSheetPages([picture('Plan large')], 4)

    expect(page?.places[0]?.caption).toBe('Plan large')
  })

  /** Every cell has to sit on the paper: a row counted without its caption walks off the bottom. */
  it('keeps every cell inside the page', () => {
    const { columns, rows } = sheetLayout(3)
    const [page] = contactSheetPages(many(columns * rows), 3)

    for (const place of page?.places ?? []) {
      expect(place.x).toBeGreaterThanOrEqual(0)
      expect(place.y).toBeGreaterThan(0)
      expect(place.x + place.width).toBeLessThanOrEqual(A4_POINTS.width)
      expect(place.y + place.height).toBeLessThanOrEqual(A4_POINTS.height)
    }
  })

  it('never answers a grid of nothing, however few columns are asked for', () => {
    expect(sheetLayout(0).columns).toBe(1)
    expect(sheetLayout(-3).columns).toBe(1)
  })
})
