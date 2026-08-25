import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { isCsgGraph } from '@shared/domain/csg'
import { canCarve, carveGraph, isCarvable } from './carve'
import { meshNode } from '../scene/nodeFactory'
import type { SceneNode } from '../scene/sceneState'

function wall(): SceneNode {
  return { ...meshNode({ kind: 'box', width: 4, height: 3, depth: 0.2 }), name: 'wall' }
}

function cube(at: { x: number; y: number; z: number }): SceneNode {
  const node = meshNode({ kind: 'box', width: 1, height: 1, depth: 1 })
  return { ...node, name: 'hole', transform: { ...IDENTITY_TRANSFORM, position: at } }
}

/** The caller decides which node is the matter; these tests spell that split out loud. */
const cut = (nodes: readonly SceneNode[], all: readonly SceneNode[] = nodes) => {
  const [matter, ...tools] = nodes.filter(isCarvable)
  return matter && tools.length > 0 ? carveGraph(matter, tools, 'subtract', all) : null
}

describe('carveGraph', () => {
  it('makes the first node the matter and the rest the tools', () => {
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
    const only = [wall()]
    expect(cut(only, only)).toBeNull()
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
    const [matter, ...tools] = nodes.filter(isCarvable)
    if (!matter) throw new Error('the wall carries a shape')
    expect(carveGraph(matter, tools, 'unite', nodes).steps[0]?.operation).toBe('unite')
  })
})
