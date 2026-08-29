import { describe, expect, it } from 'vitest'
import { memoryLayoutOf, type MemoryGraphNode } from './memoryLayout'

const node = (id: string): MemoryGraphNode => ({ id, type: 'script', label: id })

const spread = (nodes: readonly { x: number; y: number }[]): number => {
  const xs = nodes.map(one => one.x)
  const ys = nodes.map(one => one.y)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

const between = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

describe('placing the memories of a project', () => {
  it('places nothing for nothing', () => {
    expect(memoryLayoutOf([], [])).toEqual({ nodes: [], edges: [] })
  })

  it('counts how many links reach each memory, which is what sizes it', () => {
    const placed = memoryLayoutOf(
      [node('a'), node('b'), node('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
    )

    expect(placed.nodes.map(one => one.degree)).toEqual([2, 1, 1])
  })

  // The whole point of a force layout: what is tied lands together, what is not lands apart.
  it('holds linked memories closer than unlinked ones', () => {
    const placed = memoryLayoutOf([node('a'), node('b'), node('far')], [{ from: 'a', to: 'b' }])
    const [a, b, far] = placed.nodes
    if (!a || !b || !far) throw new Error('three were placed')

    expect(between(a, b)).toBeLessThan(between(a, far))
  })

  it('opens a bigger graph out rather than balling it up', () => {
    const many = Array.from({ length: 40 }, (_, i) => node(`n${i}`))
    const few = [node('a'), node('b'), node('c')]

    expect(spread(memoryLayoutOf(many, []).nodes)).toBeGreaterThan(
      spread(memoryLayoutOf(few, []).nodes),
    )
  })

  /**
   * 🛑 The same memories place the same way twice. A layout seeded at random redraws differently
   * on every open, and a reader who had learned the shape of their own project loses it.
   */
  it('places the same graph identically on a second run', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')]
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
    ]

    expect(memoryLayoutOf(nodes, edges)).toEqual(memoryLayoutOf(nodes, edges))
  })

  // An edge naming a memory that is gone — a link outlives its target — must not place a ghost.
  it('drops an edge whose ends it cannot find', () => {
    const placed = memoryLayoutOf([node('a')], [{ from: 'a', to: 'gone' }])

    expect(placed.edges).toEqual([])
    expect(placed.nodes[0]?.degree).toBe(0)
  })

  it('places every memory somewhere real, whatever the count', () => {
    const placed = memoryLayoutOf(
      Array.from({ length: 24 }, (_, i) => node(`n${i}`)),
      [],
    )

    expect(placed.nodes.every(one => Number.isFinite(one.x) && Number.isFinite(one.y))).toBe(true)
  })
})
