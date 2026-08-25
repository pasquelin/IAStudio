import { describe, expect, it } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { carveGraph, isCarvable } from './carve'
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
    expect(cut(nodes, nodes)?.base.transform).toEqual(IDENTITY_TRANSFORM)
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

  // Refused rather than folded in: the flat list of steps holds no nested recipe, so a solid
  // taken as a brush would keep its base and silently drop every cut already made in it.
  it('refuses a solid, which carries a recipe rather than a shape', () => {
    const solid = { ...wall(), type: 'carved' } as unknown as SceneNode
    expect(cut([solid, cube({ x: 1, y: 0, z: 0 })])).toBeNull()
  })

  it('ignores what carries no shape at all', () => {
    const nodes: SceneNode[] = [wall(), { ...wall(), type: 'group' } as SceneNode]
    expect(cut(nodes, nodes)).toBeNull()
  })

  it('carries the operation asked for, so a weld is not a cut', () => {
    const nodes = [wall(), cube({ x: 0, y: 0, z: 0 })]
    const [matter, ...tools] = nodes.filter(isCarvable)
    if (!matter) throw new Error('the wall carries a shape')
    expect(carveGraph(matter, tools, 'unite', nodes).steps[0]?.operation).toBe('unite')
  })
})
