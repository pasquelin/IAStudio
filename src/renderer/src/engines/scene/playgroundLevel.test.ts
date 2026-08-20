import { describe, expect, it } from 'vitest'
import { forgetCheckerTextures, rememberCheckerTextures } from './checkerTextures'
import { playgroundNodes } from './playgroundLevel'
import type { SceneNode } from './sceneState'

const meshes = (nodes: readonly SceneNode[]): SceneNode[] => nodes.filter(n => n.type === 'mesh')

type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/**
 * Where a block stands and how far it reaches, which is the whole of what a level is made of.
 * Boxes alone, and untilted ones: a shape at an angle is not bounded by its own dimensions.
 */
function boxOf(node: SceneNode): Box | null {
  if (node.type !== 'mesh' || node.geometry.kind !== 'box') return null
  if (node.transform.rotation.x !== 0 || node.transform.rotation.z !== 0) return null

  const { width, height, depth } = node.geometry
  const { x, y, z } = node.transform.position
  return {
    x0: x - width / 2,
    x1: x + width / 2,
    y0: y - height / 2,
    y1: y + height / 2,
    z0: z - depth / 2,
    z1: z + depth / 2,
  }
}

const named = (nodes: readonly SceneNode[], name: string): SceneNode | undefined =>
  nodes.find(node => node.name === name)

/** Strictly, so two parts that merely touch at a face — which is what a joint IS — do not count. */
function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1 && a.z0 < b.z1 && b.z0 < a.z1
}

describe('the playground level', () => {
  it('walls the set on all four sides, so a walk meets something', () => {
    const walls = ['Wall North', 'Wall South', 'Wall East', 'Wall West'].map(name =>
      named(playgroundNodes(), name),
    )

    expect(walls.every(wall => wall !== undefined)).toBe(true)
  })

  /**
   * What sent this batch back, seen on screen: the four walls were each the full width and each
   * centred ON the edge, so every corner held two boxes in the same place — a double seam down
   * all four, and half of each wall hanging over the void outside.
   */
  it('joins the walls at the corners instead of overlapping them', () => {
    const walls = meshes(playgroundNodes())
      .filter(node => node.name.startsWith('Wall '))
      .map(boxOf)
      .filter(box => box !== null)

    expect(walls).toHaveLength(4)
    for (const [index, wall] of walls.entries()) {
      for (const other of walls.slice(index + 1)) expect(overlaps(wall, other)).toBe(false)
    }
  })

  /**
   * A `plane` is one-sided: seen from below, the floor of the level simply vanished and the set
   * hung in the air. A slab also gives the sunken court its walls, at no extra part.
   */
  it('builds the floor as a solid, so it is there from underneath', () => {
    const floor = boxOf(named(playgroundNodes(), 'Floor North') as SceneNode)

    expect(floor).not.toBeNull()
    expect(floor && floor.y1 - floor.y0).toBeGreaterThan(0.5)
    expect(floor?.y1).toBeCloseTo(0)
  })

  it('leaves the court open, which is what a fall is tested against', () => {
    const overTheCourt = meshes(playgroundNodes())
      .map(boxOf)
      .filter(box => box !== null)
      .filter(box => box.x0 < 0 && 0 < box.x1 && box.z0 < 0 && 0 < box.z1 && box.y1 >= 0)

    // The plank crosses it and nothing else does: a floor slab over the centre would fill it.
    expect(overTheCourt).toHaveLength(1)
    expect(named(playgroundNodes(), 'Plank')).toBeDefined()
  })

  it('sinks the court below the floor it is cut into', () => {
    const nodes = playgroundNodes()
    const court = boxOf(named(nodes, 'Court Floor') as SceneNode)
    const floor = boxOf(named(nodes, 'Floor North') as SceneNode)

    expect(court && floor && court.y1).toBeLessThan(floor?.y1 ?? 0)
  })

  /**
   * The stair is what makes the court a place one comes BACK from. Built the other way round it
   * climbed towards mid-court and ended at floor level over the drop, which no rule here saw.
   */
  it('climbs out of the court, top step against the edge it leads onto', () => {
    const steps = meshes(playgroundNodes())
      .filter(node => node.name.startsWith('Court Step '))
      .map(boxOf)
      .filter(box => box !== null)
      .sort((a, b) => a.y1 - b.y1)

    expect(steps).toHaveLength(5)
    expect(steps.at(-1)?.y1).toBeCloseTo(0)
    // Each nose stands one rise above the last, and each tread starts where the last one ended.
    for (const [index, step] of steps.slice(1).entries()) {
      expect(step.y1 - (steps[index]?.y1 ?? 0)).toBeCloseTo(0.5)
      expect(step.x0).toBeCloseTo(steps[index]?.x1 ?? 0)
    }
  })

  /**
   * The ramp was once pitched the other way: it climbed AWAY from its landing, its foot buried
   * under the floor and its top floating, connected to nothing.
   */
  it('lands the ramp on the terrace, and rests its foot on the floor', () => {
    const nodes = playgroundNodes()
    const ramp = named(nodes, 'Ramp')
    const terrace = boxOf(named(nodes, 'Terrace') as SceneNode)
    if (ramp?.type !== 'mesh' || ramp.geometry.kind !== 'box' || !terrace)
      throw new Error('no ramp')

    const rise = (ramp.geometry.depth / 2) * Math.sin(ramp.transform.rotation.x)

    // The high end is the one the terrace waits at — towards -Z — and it arrives at its height.
    expect(ramp.transform.position.y + rise).toBeCloseTo(terrace.y1, 1)
    expect(ramp.transform.position.y - rise).toBeCloseTo(0, 1)
  })

  it('raises the jump blocks one above the other, widening the gaps between them', () => {
    const blocks = meshes(playgroundNodes())
      .filter(node => node.name.startsWith('Jump Block '))
      .map(boxOf)
      .filter(box => box !== null)

    expect(blocks).toHaveLength(3)
    expect(blocks.map(block => block.y1)).toEqual(
      [...blocks.map(block => block.y1)].sort((a, b) => a - b),
    )

    const gaps = blocks.slice(1).map((block, index) => block.x0 - (blocks[index]?.x1 ?? 0))
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b))
  })

  it('names every part, so the outliner is not a column of « Box »', () => {
    const names = playgroundNodes().map(node => node.name)

    expect(names.filter(name => name === 'Box' || name === 'Plane')).toEqual([])
    expect(new Set(names).size).toBe(names.length)
  })

  it('hangs every part under a group, so the outliner stays readable', () => {
    const nodes = playgroundNodes()
    const groups = nodes.filter(node => node.type === 'group')

    expect(groups.map(group => group.name)).toEqual(['Ground', 'Enclosure', 'Course'])
    expect(nodes.filter(node => node.parentId === null)).toEqual(groups)
  })

  /** No shape is born bare — see `checkerTextures`. A grey set says nothing about its own scale. */
  it('dresses every part in a working texture', () => {
    rememberCheckerTextures([
      { id: 'checkerLarge', assetId: 'asset_large' },
      { id: 'checkerSmall', assetId: 'asset_small' },
      { id: 'gridLarge', assetId: 'asset_grid' },
      { id: 'gridSmall', assetId: 'asset_grid_small' },
    ])

    const bare = meshes(playgroundNodes()).filter(
      node => node.type === 'mesh' && node.material.map === null,
    )
    forgetCheckerTextures()

    expect(bare.map(node => node.name)).toEqual([])
  })

  it('builds a fresh level each time, sharing no id with the last', () => {
    const first = playgroundNodes().map(node => node.id)
    const second = playgroundNodes().map(node => node.id)

    expect(new Set([...first, ...second]).size).toBe(first.length + second.length)
  })
})
