import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { isCsgGraph, type CsgOperation } from '@shared/domain/csg'
import { canCarve, carveGraph, carvePlan, isCarvable } from './carve'
import { meshNode } from '../scene/nodeFactory'
import type { SceneNode } from '../scene/sceneState'

function wall(): SceneNode {
  return { ...meshNode({ kind: 'box', width: 4, height: 3, depth: 0.2 }), name: 'wall' }
}

function cube(at: { x: number; y: number; z: number }): SceneNode {
  const node = meshNode({ kind: 'box', width: 1, height: 1, depth: 1 })
  return { ...node, name: 'hole', transform: { ...IDENTITY_TRANSFORM, position: at } }
}

/** The two halves the toolbar runs, in the order it runs them: elect, then compose. */
const cut = (
  nodes: readonly SceneNode[],
  all: readonly SceneNode[] = nodes,
  operation: CsgOperation = 'subtract',
) => {
  const plan = carvePlan(nodes.filter(isCarvable), operation, all)
  return plan && plan.tools.length > 0 ? carveGraph(plan.matter, plan.tools, all) : null
}

const marked = (node: SceneNode): SceneNode =>
  node.type === 'mesh' ? { ...node, negative: true } : node

describe('carveGraph', () => {
  it('makes the biggest shape the matter and the rest the tools', () => {
    const nodes = [wall(), cube({ x: 1, y: 0, z: 0 })]
    const graph = cut(nodes, nodes)

    expect(graph?.base.name).toBe('wall')
    expect(graph?.steps).toHaveLength(1)
    expect(graph?.steps[0]?.operation).toBe('subtract')
  })

  it('rewrites a tool into the matter frame, so moving the solid carries the hole', () => {
    const matter = {
      ...wall(),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 10, y: 0, z: 0 } },
    }
    const tool = cube({ x: 11, y: 0, z: 0 })
    const graph = cut([matter, tool], [matter, tool])

    // A metre to the right of the wall, wherever the wall itself stands.
    expect(graph?.steps[0]?.part.transform.position.x).toBeCloseTo(1)
  })

  it('leaves the matter at the origin of its own frame', () => {
    const nodes = [wall(), cube({ x: 1, y: 0, z: 0 })]
    expect(cut(nodes, nodes)?.base.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  /**
   * The matter's SCALE travels in its brush, never in the solid's frame. Inverting a non-uniform
   * scale into a turned tool yields a sheared matrix, which `Matrix4.decompose` cannot describe —
   * measured at 2.09 units of drift on a wall scaled (4, 3, 0.2) with a tool turned 30°.
   */
  it('places a turned tool exactly, even under a non-uniformly scaled matter', () => {
    const matter = {
      ...wall(),
      transform: { ...IDENTITY_TRANSFORM, scale: { x: 4, y: 3, z: 0.2 } },
    }
    const tool = {
      ...cube({ x: 1, y: 0, z: 0 }),
      transform: {
        ...IDENTITY_TRANSFORM,
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 6, z: 0 },
      },
    }
    const step = cut([matter, tool], [matter, tool])?.steps[0]?.part

    expect(step?.transform.position.x).toBeCloseTo(1, 6)
    expect(step?.transform.position.y).toBeCloseTo(0, 6)
    expect(step?.transform.position.z).toBeCloseTo(0, 6)
    expect(step?.transform.rotation.y).toBeCloseTo(Math.PI / 6, 6)
    expect(step?.transform.scale.x).toBeCloseTo(1, 6)
  })

  it('carries the matter scale in its own brush, so the shape keeps its size', () => {
    const matter = {
      ...wall(),
      transform: { ...IDENTITY_TRANSFORM, scale: { x: 4, y: 3, z: 0.2 } },
    }
    const tool = cube({ x: 1, y: 0, z: 0 })
    const scale = cut([matter, tool], [matter, tool])?.base.transform.scale

    expect(scale?.x).toBeCloseTo(4, 6)
    expect(scale?.y).toBeCloseTo(3, 6)
    expect(scale?.z).toBeCloseTo(0.2, 6)
  })

  it('composes a parent transform into the tool it carries', () => {
    const parent: SceneNode = {
      ...meshNode({ kind: 'box', width: 1, height: 1, depth: 1 }),
      transform: { ...IDENTITY_TRANSFORM, position: { x: 5, y: 0, z: 0 } },
    }
    const matter = wall()
    const tool = { ...cube({ x: 2, y: 0, z: 0 }), parentId: parent.id }
    const graph = cut([matter, tool], [parent, matter, tool])

    expect(graph?.steps[0]?.part.transform.position.x).toBeCloseTo(7)
  })

  it('refuses a lone node, which no cut can be made of', () => {
    expect(canCarve([wall()])).toBe(false)
  })

  /**
   * Chaining booleans is the ordinary gesture of a modeller, and it used to be refused: the flat
   * list of steps could only have kept a solid's base and dropped its cuts. The recipe travels
   * whole into the brush instead.
   */
  it('folds a solid in whole, recipe and all', () => {
    const inner = cut([wall(), cube({ x: 1, y: 0, z: 0 })])
    if (!inner) throw new Error('the first fold was refused')

    const solid: SceneNode = {
      ...meshNode({ kind: 'box', width: 1, height: 1, depth: 1 }),
      type: 'carved',
      carved: inner,
    } as unknown as SceneNode
    const again = cut([solid, cube({ x: 2, y: 0, z: 0 })])
    const base = again?.base.geometry

    expect(again).not.toBeNull()
    // The whole first recipe, not merely the shape it rested on.
    expect(base && isCsgGraph(base) && base.steps).toHaveLength(1)
  })

  // Refused rather than quietly dropped: filtering it out used to promote the NEXT node to
  // matter, so a client naming three nodes got a cut of two it never asked for.
  it('refuses a selection where anything carries no shape', () => {
    const nodes: SceneNode[] = [
      wall(),
      cube({ x: 1, y: 0, z: 0 }),
      { ...wall(), type: 'group' } as SceneNode,
    ]
    expect(canCarve(nodes)).toBe(false)
  })

  it('carries the operation asked for, so a weld is not a cut', () => {
    const nodes = [wall(), cube({ x: 0, y: 0, z: 0 })]
    expect(cut(nodes, nodes, 'unite')?.steps[0]?.operation).toBe('unite')
  })
})

/**
 * Adding a shape SELECTS it, so the natural gesture — drop the tool in, then add the wall — fed
 * the two the wrong way round every time, and an undo emptying the selection is what made it
 * "work on the third try".
 */
describe('carvePlan', () => {
  const roles = (picked: readonly SceneNode[], operation: CsgOperation = 'subtract') =>
    carvePlan(picked.filter(isCarvable), operation, picked)

  it('elects the same matter whichever shape was clicked first', () => {
    const [big, small] = [wall(), cube({ x: 1, y: 0, z: 0 })]

    expect(roles([big, small])?.matter.name).toBe('wall')
    expect(roles([small, big])?.matter.name).toBe('wall')
  })

  it('writes the same steps whichever shape was clicked first', () => {
    const [big, small] = [wall(), cube({ x: 1, y: 0, z: 0 })]
    const named = (picked: readonly SceneNode[]) => roles(picked)?.tools.map(tool => tool.node.name)

    expect(named([small, big])).toEqual(named([big, small]))
  })

  /**
   * The volume, never the bounding box: a wall 4 × 3 × 0.2 has a box six times a unit cube's and
   * barely twice its matter — 2.4 against 1. A box that reached the other way would have made
   * this rule pick the wrong shape for exactly the wall this studio is used to build.
   */
  it('weighs matter rather than the box it fits in', () => {
    // Wide and flat, so its bounding box beats the cube's while its matter does not.
    const sliver: SceneNode = {
      ...meshNode({ kind: 'box', width: 8, height: 8, depth: 0.001 }),
      name: 'sliver',
    }
    expect(roles([sliver, cube({ x: 0, y: 0, z: 0 })])?.matter.name).toBe('hole')
  })

  it('counts the scale a shape is placed at, not the shape alone', () => {
    const grown: SceneNode = {
      ...cube({ x: 5, y: 0, z: 0 }),
      name: 'grown',
      transform: { ...IDENTITY_TRANSFORM, scale: { x: 4, y: 4, z: 4 } },
    }
    expect(roles([grown, wall()])?.matter.name).toBe('grown')
  })

  /** Roblox's Negate: the sense of a cut belongs to the object, and is shown on it. */
  it('makes a marked shape a tool even when it is the biggest', () => {
    const plan = roles([marked(wall()), cube({ x: 1, y: 0, z: 0 })])

    expect(plan?.matter.name).toBe('hole')
    expect(plan?.tools.map(tool => tool.node.name)).toEqual(['wall'])
  })

  /** A union holding a negative IS a piercing — the whole of how Roblox spells a subtraction. */
  it('subtracts a marked shape even when the button says unite', () => {
    const plan = roles([wall(), marked(cube({ x: 1, y: 0, z: 0 }))], 'unite')

    expect(plan?.matter.name).toBe('wall')
    expect(plan?.tools[0]?.operation).toBe('subtract')
  })

  it('leaves the button its say over what is not marked', () => {
    const plan = roles([wall(), cube({ x: 1, y: 0, z: 0 })], 'unite')
    expect(plan?.tools[0]?.operation).toBe('unite')
  })

  /**
   * Roblox refuses this outright. Refusing here would be a live-looking button doing nothing —
   * `canCarve` is what greys it out, and it cannot see a mark.
   */
  it('drops the marks when everything is marked, rather than folding to nothing', () => {
    const plan = roles([marked(wall()), marked(cube({ x: 1, y: 0, z: 0 }))])

    expect(plan?.matter.name).toBe('wall')
    expect(plan?.tools[0]?.operation).toBe('subtract')
  })

  /**
   * `canCarve` counts IDS, and `nodeAimed` resolves an id OR a name — so two entries can be one
   * node. Folded, it would have replaced the shape with a solid that cuts nothing.
   */
  it('refuses a selection that is one shape named twice', () => {
    const one = wall()
    expect(roles([one, one])).toBeNull()
  })

  it('lets a caller name the matter outright, for the rare cut that runs the other way', () => {
    const small = cube({ x: 1, y: 0, z: 0 })
    const picked = [wall(), small]
    const plan = carvePlan(picked.filter(isCarvable), 'subtract', picked, small.id)

    expect(plan?.matter.name).toBe('hole')
  })

  /** Saying it outright outranks the mark — that is what the parameter is FOR. */
  it('takes a named matter even when that shape carries the tool mark', () => {
    const one = marked(wall())
    const picked = [one, cube({ x: 1, y: 0, z: 0 })]
    const plan = carvePlan(picked.filter(isCarvable), 'subtract', picked, one.id)

    expect(plan?.matter.name).toBe('wall')
    expect(plan?.tools.map(tool => tool.node.name)).toEqual(['hole'])
  })

  it('refuses a named matter that is not among the shapes picked', () => {
    const picked = [wall(), cube({ x: 1, y: 0, z: 0 })]
    expect(carvePlan(picked.filter(isCarvable), 'subtract', picked, 'nowhere')).toBeNull()
  })
})
