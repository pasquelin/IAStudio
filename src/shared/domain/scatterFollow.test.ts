import { describe, expect, it } from 'vitest'
import { scatterLayer } from './scatter'
import { scatterPosesOf, type ScatterGround } from './scatterGenerate'
import { scatterPosesAfterSculpt, scatterRebuildOf } from './scatterFollow'

const terrain = {
  origin: { x: 0, z: 0 },
  size: { x: 64, z: 64 },
  elevation: { min: 0, max: 1 },
  grain: 64,
  samples: { width: 65, height: 65 },
}

const dirtied = [{ column: 0, row: 0 }]

describe('scatterRebuildOf', () => {
  it('leaves poses untouched when follow is none, even after a sculpt', () => {
    expect(scatterRebuildOf('none', dirtied, terrain)).toEqual({ kind: 'none' })
  })

  it('rebuilds only the dirtied brush region when follow is brush', () => {
    const held = scatterRebuildOf('brush', dirtied, terrain)
    expect(held.kind).toBe('brush')
    if (held.kind !== 'brush') return
    expect(held.region.minX).toBe(0)
    expect(held.region.minZ).toBe(0)
    expect(held.region.maxX).toBeGreaterThan(0)
    expect(held.region.maxX).toBeGreaterThanOrEqual(64)
  })

  it('rebuilds the whole layer when follow is layer and anything moved', () => {
    expect(scatterRebuildOf('layer', dirtied, terrain)).toEqual({ kind: 'all' })
    expect(scatterRebuildOf('layer', [], terrain)).toEqual({ kind: 'none' })
  })

  it('keeps previous poses on none, replaces the brush region, and regenerates all on layer', () => {
    const layer = scatterLayer({
      id: 'trees',
      assets: [{ assetId: 'pine', weight: 1 }],
      origin: { x: 0, z: 0 },
      size: { x: 20, z: 20 },
    })
    const low: ScatterGround = {
      heightAt: () => 1,
      slopeAt: () => ({ degrees: 0, nx: 0, ny: 1, nz: 0 }),
    }
    const high: ScatterGround = {
      heightAt: () => 8,
      slopeAt: () => ({ degrees: 0, nx: 0, ny: 1, nz: 0 }),
    }
    const previous = scatterPosesOf(layer, { minX: 0, minZ: 0, maxX: 20, maxZ: 20 }, low)
    expect(previous.length).toBeGreaterThan(0)
    expect(scatterPosesAfterSculpt(layer, previous, { kind: 'none' }, high)).toEqual(previous)
    const brushed = scatterPosesAfterSculpt(
      layer,
      previous,
      { kind: 'brush', region: { minX: 0, minZ: 0, maxX: 8, maxZ: 8 } },
      high,
    )
    const outside = previous.filter(pose => pose.x >= 8 || pose.z >= 8)
    expect(brushed.filter(pose => pose.x >= 8 || pose.z >= 8)).toEqual(outside)
    expect(
      scatterPosesAfterSculpt(layer, previous, { kind: 'all' }, high).every(pose => pose.y === 8),
    ).toBe(true)
  })
})
