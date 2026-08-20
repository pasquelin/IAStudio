import { describe, expect, it } from 'vitest'
import { playgroundNodes } from './playgroundLevel'
import type { SceneNode } from './sceneState'

const meshes = (nodes: readonly SceneNode[]): SceneNode[] => nodes.filter(n => n.type === 'mesh')

/** Where a shape stands and how big it is, which is the whole of what a level is made of. */
function spanOf(node: SceneNode): { x: number; z: number } | null {
  if (node.type !== 'mesh') return null
  const { geometry } = node
  if (geometry.kind === 'plane') return { x: geometry.width, z: geometry.height }
  if (geometry.kind === 'box') return { x: geometry.width, z: geometry.depth }
  return null
}

describe('the playground level', () => {
  it('leaves a hole in the floor, which is what a fall is tested against', () => {
    const bands = meshes(playgroundNodes()).filter(node => spanOf(node) !== null)
    const overTheCentre = bands.filter(node => {
      const span = spanOf(node)
      return (
        span !== null &&
        Math.abs(node.transform.position.x) < span.x / 2 &&
        Math.abs(node.transform.position.z) < span.z / 2 &&
        node.transform.position.y <= 0
      )
    })

    // The plank crosses it and nothing else does: a floor band over the centre would fill the pit.
    expect(overTheCentre).toHaveLength(1)
    expect(overTheCentre[0]?.type === 'mesh' && overTheCentre[0].geometry.kind).toBe('box')
  })

  it('closes the set on all four sides, so a walk meets something', () => {
    // The edge of the floor, where a wall stands and nothing else does.
    const sides = meshes(playgroundNodes())
      .map(node => node.transform.position)
      .filter(({ x, z }) => Math.abs(x) === 20 || Math.abs(z) === 20)
      .map(({ x, z }) => `${Math.sign(x)}:${Math.sign(z)}`)

    expect(new Set(sides)).toEqual(new Set(['0:-1', '0:1', '-1:0', '1:0']))
  })

  it('offers both ways up — a slope and steps', () => {
    const nodes = meshes(playgroundNodes())

    expect(nodes.some(node => node.transform.rotation.x !== 0)).toBe(true)
    expect(nodes.filter(node => node.transform.position.x === 12).length).toBeGreaterThanOrEqual(5)
  })

  it('raises the jump blocks one above the other, or there is nothing to miss', () => {
    const heights = meshes(playgroundNodes())
      .filter(node => node.transform.position.z === -15)
      .map(node => node.transform.position.y)

    expect(heights).toHaveLength(3)
    expect([...heights].sort((a, b) => a - b)).toEqual(heights)
  })

  it('tiles the floor by the metre rather than stretching one picture over forty', () => {
    const floor = meshes(playgroundNodes()).find(
      node => node.type === 'mesh' && node.geometry.kind === 'plane',
    )

    expect(floor?.type === 'mesh' && floor.material.uvScale).toBeGreaterThan(10)
  })

  it('hangs every part under a group, so the outliner stays readable', () => {
    const nodes = playgroundNodes()
    const groups = nodes.filter(node => node.type === 'group')

    expect(groups).toHaveLength(3)
    expect(nodes.filter(node => node.parentId === null)).toEqual(groups)
  })

  it('builds a fresh level each time, sharing no id with the last', () => {
    const first = playgroundNodes().map(node => node.id)
    const second = playgroundNodes().map(node => node.id)

    expect(new Set([...first, ...second]).size).toBe(first.length + second.length)
  })
})
