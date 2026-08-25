import { describe, expect, it } from 'vitest'
import { regionsByGrid, type Centres, type SpatialRegions } from './instanceRegions'

type Place = [number, number, number]

function centresAt(places: readonly Place[]): Centres {
  const at = new Float64Array(places.length * 3)
  for (const [slot, place] of places.entries()) at.set(place, slot * 3)
  return { at, count: places.length }
}

/** A floor of `count` instances laid on a square, which is what a level of decor looks like. */
function tiled(count: number, spread: number): Centres {
  const side = Math.ceil(Math.sqrt(count))
  return centresAt(
    Array.from({ length: count }, (_unused, slot): Place => {
      const step = spread / side
      return [(slot % side) * step, 0, Math.floor(slot / side) * step]
    }),
  )
}

function slotsOf(regions: SpatialRegions, region: number): number[] {
  const from = regions.starts[region] ?? 0
  return [...regions.order.slice(from, regions.starts[region + 1] ?? 0)]
}

const regionCount = (regions: SpatialRegions): number => regions.starts.length - 1

describe('regionsByGrid', () => {
  it('gives every instance to one region and only one', () => {
    const regions = regionsByGrid(tiled(1_000, 400), 16)
    const seen = Array.from({ length: regionCount(regions) }, (_unused, region) =>
      slotsOf(regions, region),
    ).flat()

    // The defect this guards: a slot dropped is geometry that vanishes, a slot twice is a shape
    // drawn on top of itself — and neither says a word.
    expect(seen.toSorted((a, b) => a - b)).toEqual([...Array.from({ length: 1_000 }).keys()])
  })

  it('cuts a flat level into about as many regions as were asked for', () => {
    // A floor is the case that bites: solving for a division per axis rounds the vertical one
    // down and the other two multiply to compensate — 324 cells where 40 were asked for.
    for (const cells of [4, 16, 40]) {
      const count = regionCount(regionsByGrid(tiled(10_000, 600), cells))
      expect(count).toBeGreaterThanOrEqual(cells)
      expect(count).toBeLessThan(cells * 2)
    }
  })

  it('divides a level asked for two regions, however few instances stand on it', () => {
    // The same rounding, the other way: two cells over two wide axes wanted 1.41 divisions each,
    // rounded both to one, and every group under 512 instances came back whole.
    expect(regionCount(regionsByGrid(tiled(200, 600), 2))).toBeGreaterThan(1)
  })

  it('keeps instances that stand apart in regions that stand apart', () => {
    const here = Array.from({ length: 300 }, (_unused, at): Place => [at * 0.1, 0, 0])
    const far = Array.from({ length: 300 }, (_unused, at): Place => [1_000 + at * 0.1, 0, 0])
    const regions = regionsByGrid(centresAt([...here, ...far]), 8)

    // What the whole split is for: no region may straddle the empty ground between two clumps,
    // or the frustum has nothing it can drop.
    for (let region = 0; region < regionCount(regions); region += 1) {
      const slots = slotsOf(regions, region)
      expect(slots.some(slot => slot < 300) && slots.some(slot => slot >= 300)).toBe(false)
    }
  })

  it('makes one region of instances that all stand on the same spot', () => {
    const stacked = centresAt(Array.from({ length: 1_000 }, (): Place => [4, 2, 7]))

    // Nothing to cull, so nothing to split: dividing here would buy draw calls for no answer.
    expect(regionCount(regionsByGrid(stacked, 16))).toBe(1)
  })
})
