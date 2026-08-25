import { Box3, BufferAttribute, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { csgPartOf, type CsgGraph, type CsgPart } from '@shared/domain/csg'
import { DEFAULT_MATERIAL } from '../scene/sceneState'
import { evaluateGraph } from './csgEvaluate'
import type { CsgMesh } from './csgMessage'

/**
 * The real cut, run in Node. Its own suite because the worker hides everything: the evaluator
 * reads a brush's POSITION off its matrix but not its SCALE, so a pillar scaled six times tall
 * came out one unit tall — and nothing in the studio was red.
 */
const cube = (name: string): CsgPart =>
  csgPartOf(name, { kind: 'box', width: 1, height: 1, depth: 1 }, DEFAULT_MATERIAL)

const placed = (part: CsgPart, transform: Partial<CsgPart['transform']>): CsgPart => ({
  ...part,
  transform: { ...part.transform, ...transform },
})

function sizeOf(mesh: CsgMesh): Vector3 {
  const size = new Vector3()
  new Box3().setFromBufferAttribute(new BufferAttribute(mesh.position, 3)).getSize(size)
  return size
}

const graph = (base: CsgPart, steps: CsgGraph['steps']): CsgGraph => ({
  base,
  steps,
  collision: 'trimesh',
})

describe('evaluateGraph', () => {
  it('keeps the size a scaled brush was given', () => {
    const pillar = placed(cube('Pillar'), { scale: { x: 1, y: 6, z: 1 } })
    const beside = placed(cube('Beside'), { position: { x: 0.6, y: 0, z: 0 } })
    const size = sizeOf(evaluateGraph(graph(pillar, [{ operation: 'unite', part: beside }])))

    // Six, never one: the defect this suite exists for.
    expect(size.y).toBeCloseTo(6, 3)
    expect(size.x).toBeCloseTo(1.6, 3)
  })

  it('keeps the turn a rotated brush was given', () => {
    const wall = placed(cube('Wall'), { scale: { x: 1, y: 6, z: 1 } })
    const turned = placed(cube('Turned'), {
      position: { x: 0.6, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 4, z: 0 },
    })
    const size = sizeOf(evaluateGraph(graph(wall, [{ operation: 'unite', part: turned }])))

    // A cube turned 45° is √2 across, so the union is deeper than either brush alone.
    expect(size.z).toBeCloseTo(Math.SQRT2, 2)
  })

  it('takes a hole right through, so a window opens in a wall', () => {
    const wall = placed(cube('Wall'), { scale: { x: 4, y: 3, z: 0.2 } })
    const hole = placed(cube('Hole'), { position: { x: 0, y: 0, z: 0 } })
    const pierced = evaluateGraph(graph(wall, [{ operation: 'subtract', part: hole }]))

    // The wall keeps its own size — a cut takes matter away, never the outline.
    const size = sizeOf(pierced)
    expect(size.x).toBeCloseTo(4, 3)
    expect(size.y).toBeCloseTo(3, 3)
    // And it costs more triangles than the plain box it was, because the opening is walled.
    expect(pierced.position.length / 3).toBeGreaterThan(36)
  })

  it('keeps only what two brushes share', () => {
    const left = cube('Left')
    const right = placed(cube('Right'), { position: { x: 0.5, y: 0, z: 0 } })
    const size = sizeOf(evaluateGraph(graph(left, [{ operation: 'intersect', part: right }])))

    expect(size.x).toBeCloseTo(0.5, 3)
    expect(size.y).toBeCloseTo(1, 3)
  })

  it('hands back normals and uvs, which a material needs to light and to map', () => {
    const cut = evaluateGraph(
      graph(cube('A'), [
        { operation: 'subtract', part: placed(cube('B'), { position: { x: 0.5, y: 0, z: 0 } }) },
      ]),
    )

    expect(cut.normal.length).toBe(cut.position.length)
    expect(cut.uv.length).toBe((cut.position.length / 3) * 2)
  })
})
