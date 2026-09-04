import { isCsgGraph, type CsgGraph, type CsgPart } from '@shared/domain/csg'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import type {
  CompiledNodeGeometry,
  CompiledSceneOptimization,
  LossyOptimization,
} from '@shared/domain/gameExport'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import type { SceneNode, SceneState } from './sceneState'

/** Compiles only runtime hints; the authoring state is neither mutated nor embedded in the plan. */
export function compileLossyWorld(
  state: Pick<SceneState, 'nodes'>,
  options: LossyOptimization,
): CompiledSceneOptimization | undefined {
  if (!options.generateLods && options.geometrySimplification === 'off') return undefined

  const ratio = DEFAULT_OPTIMIZATION_POLICY.simplificationRatios[options.geometrySimplification]
  const nodes = state.nodes.flatMap(node => compiledNode(node, options.generateLods, ratio))
  return nodes.length > 0 ? { nodes } : undefined
}

function compiledNode(
  node: SceneNode,
  generateLods: boolean,
  ratio: number,
): readonly CompiledNodeGeometry[] {
  if (node.optimization?.mode === 'exclude') return []
  if (node.type === 'mesh') {
    if (generateLods) {
      return [
        {
          nodeId: node.id,
          lodGeometries: [
            node.geometry,
            ...DEFAULT_OPTIMIZATION_POLICY.lodSimplificationRatios.map(level =>
              reducedGeometry(node.geometry, Math.max(level, ratio)),
            ),
          ],
        },
      ]
    }
    return [{ nodeId: node.id, geometry: reducedGeometry(node.geometry, ratio) }]
  }
  if (node.type === 'carved') {
    if (generateLods) {
      return [
        {
          nodeId: node.id,
          lodCarved: [
            node.carved,
            ...DEFAULT_OPTIMIZATION_POLICY.lodSimplificationRatios.map(level =>
              reducedGraph(node.carved, Math.max(level, ratio)),
            ),
          ],
        },
      ]
    }
    return [{ nodeId: node.id, carved: reducedGraph(node.carved, ratio) }]
  }
  return []
}

function reducedGraph(graph: CsgGraph, ratio: number): CsgGraph {
  return {
    ...graph,
    base: reducedPart(graph.base, ratio),
    steps: graph.steps.map(step => ({ ...step, part: reducedPart(step.part, ratio) })),
  }
}

function reducedPart(part: CsgPart, ratio: number): CsgPart {
  return {
    ...part,
    geometry: isCsgGraph(part.geometry)
      ? reducedGraph(part.geometry, ratio)
      : reducedGeometry(part.geometry, ratio),
  }
}

function reducedGeometry(geometry: GeometryDescriptor, ratio: number): GeometryDescriptor {
  const segments = (value: number, minimum: number): number =>
    Math.max(minimum, Math.round(value * (1 - ratio)))

  switch (geometry.kind) {
    case 'ribbon':
      return { ...geometry, segments: segments(geometry.segments, 1) }
    case 'capsule':
      return {
        ...geometry,
        capSegments: segments(geometry.capSegments, 1),
        radialSegments: segments(geometry.radialSegments, 3),
      }
    case 'circle':
    case 'cylinder':
    case 'ring':
      return { ...geometry, segments: segments(geometry.segments, 3) }
    case 'lathe':
      return { ...geometry, segments: segments(geometry.segments, 3) }
    case 'sphere':
      return {
        ...geometry,
        widthSegments: segments(geometry.widthSegments, 3),
        heightSegments: segments(geometry.heightSegments, 2),
      }
    case 'torus':
    case 'torusKnot':
    case 'tube':
      return {
        ...geometry,
        radialSegments: segments(geometry.radialSegments, 3),
        tubularSegments: segments(geometry.tubularSegments, 3),
      }
    case 'box':
    case 'dodecahedron':
    case 'icosahedron':
    case 'octahedron':
    case 'plane':
    case 'tetrahedron':
      return geometry
  }
}
