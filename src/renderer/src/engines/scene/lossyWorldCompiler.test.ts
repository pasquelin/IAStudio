import { describe, expect, it } from 'vitest'
import { NO_LOSSY_OPTIMIZATION } from '@shared/domain/gameExport'
import { carvedNode, meshNode } from './nodeFactory'
import { compileLossyWorld } from './lossyWorldCompiler'
import { csgPartOf } from '@shared/domain/csg'
import { DEFAULT_MATERIAL } from './sceneState'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import type { CsgGraph } from '@shared/domain/csg'

const SPHERE = {
  kind: 'sphere',
  radius: 1,
  widthSegments: 40,
  heightSegments: 20,
} satisfies GeometryDescriptor

describe('the LOSSY world compiled for an export', () => {
  it('produces no runtime geometry while geometry losses are off', () => {
    expect(compileLossyWorld({ nodes: [meshNode(SPHERE)] }, NO_LOSSY_OPTIMIZATION)).toBeUndefined()
  })

  it('reduces the exported descriptor without touching the authoring node', () => {
    const node = meshNode(SPHERE)
    const compiled = compileLossyWorld(
      { nodes: [node] },
      { ...NO_LOSSY_OPTIMIZATION, geometrySimplification: 'balanced' },
    )

    expect(compiled?.nodes[0]?.geometry).toEqual({
      ...SPHERE,
      widthSegments: 26,
      heightSegments: 13,
    })
    expect(node.type === 'mesh' && node.geometry).toEqual(SPHERE)
  })

  it('keeps LOD0 exact and lets the chosen level strengthen generated distant LODs', () => {
    const node = meshNode(SPHERE)
    const compiled = compileLossyWorld(
      { nodes: [node] },
      {
        ...NO_LOSSY_OPTIMIZATION,
        generateLods: true,
        geometrySimplification: 'aggressive',
      },
    )
    const lods = compiled?.nodes[0]?.lodGeometries

    expect(lods?.[0]).toBe(SPHERE)
    expect(lods?.[1]).toMatchObject({ widthSegments: 16, heightSegments: 8 })
    expect(lods?.[2]).toMatchObject({ widthSegments: 14, heightSegments: 7 })
  })

  it('reduces every primitive nested in a carved recipe', () => {
    const graph: CsgGraph = {
      base: csgPartOf('Body', SPHERE, DEFAULT_MATERIAL),
      steps: [
        {
          operation: 'subtract',
          part: csgPartOf('Hole', SPHERE, DEFAULT_MATERIAL),
        },
      ],
      collision: 'hull',
    }
    const compiled = compileLossyWorld(
      { nodes: [carvedNode(graph)] },
      { ...NO_LOSSY_OPTIMIZATION, geometrySimplification: 'conservative' },
    )

    expect(compiled?.nodes[0]?.carved).toMatchObject({
      base: { geometry: { widthSegments: 34, heightSegments: 17 } },
      steps: [{ part: { geometry: { widthSegments: 34, heightSegments: 17 } } }],
    })
  })
})
