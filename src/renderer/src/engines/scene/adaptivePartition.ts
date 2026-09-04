import { clamp } from '@shared/numeric'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import type { OptimizationPolicy } from '@shared/domain/optimizationPolicy'
import type { SceneNode } from './sceneState'

type MeshNode = Extract<SceneNode, { type: 'mesh' }>

export type AdaptiveCell = {
  size: number
  x: number
  y: number
  z: number
}

export type AdaptiveCellGroup = {
  cell: AdaptiveCell
  nodes: MeshNode[]
}

export function adaptiveCellsOf(
  nodes: readonly MeshNode[],
  policy: OptimizationPolicy,
): readonly AdaptiveCellGroup[] {
  const roots = new Map<string, MeshNode[]>()
  for (const node of nodes) {
    const key = adaptiveRootCellKeyOf(node, policy)
    if (!key) continue
    const members = roots.get(key)
    if (members) members.push(node)
    else roots.set(key, [node])
  }
  const cells = new Map<string, AdaptiveCellGroup>()
  for (const members of roots.values()) {
    const size = adaptiveCellSize(members, policy)
    for (const node of members) {
      const cell = adaptiveCellOf(node, size, policy)
      if (!cell) continue
      const key = `${cell.size}:${cell.x}:${cell.y}:${cell.z}`
      const group = cells.get(key)
      if (group) group.nodes.push(node)
      else cells.set(key, { cell, nodes: [node] })
    }
  }
  return [...cells.values()]
}

export function adaptiveRootCellKeyOf(node: MeshNode, policy: OptimizationPolicy): string | null {
  const rootSize = maximumCellSize(policy)
  if (spatialDiameterOf(node) > rootSize) return null
  const position = node.transform.position
  return `${Math.floor(position.x / rootSize)}:${Math.floor(position.y / rootSize)}:${Math.floor(position.z / rootSize)}`
}

export function adaptiveCellOf(
  node: MeshNode,
  size: number,
  policy: OptimizationPolicy,
): AdaptiveCell | null {
  const diameter = spatialDiameterOf(node)
  if (diameter > size || size * 4 > Math.max(1, policy.maxBatchBounds)) return null
  const position = node.transform.position
  return {
    size,
    x: Math.floor(position.x / size),
    y: Math.floor(position.y / size),
    z: Math.floor(position.z / size),
  }
}

export function adaptiveCellSize(nodes: readonly MeshNode[], policy: OptimizationPolicy): number {
  if (nodes.length === 0) {
    return maximumCellSize(policy)
  }
  let lowX = Infinity
  let lowZ = Infinity
  let highX = -Infinity
  let highZ = -Infinity
  let cost = 0
  let largest = 0
  for (const node of nodes) {
    const radius = spatialDiameterOf(node) / 2
    const position = node.transform.position
    lowX = Math.min(lowX, position.x - radius)
    lowZ = Math.min(lowZ, position.z - radius)
    highX = Math.max(highX, position.x + radius)
    highZ = Math.max(highZ, position.z + radius)
    largest = Math.max(largest, radius * 2)
    cost += geometryCostOf(node.geometry)
  }
  const maxSize = maximumCellSize(policy)
  const minSize = Math.max(1, Math.min(policy.spatialCellMinSize, maxSize))
  const area = Math.max(minSize * minSize, (highX - lowX) * (highZ - lowZ))
  const desired = Math.sqrt((Math.max(1, policy.spatialCellTargetObjects) * area) / cost)
  const lowerBound = Math.max(minSize, largest)
  let size = maxSize
  while (size / 2 >= clamp(desired, lowerBound, maxSize)) size /= 2
  return size
}

function maximumCellSize(policy: OptimizationPolicy): number {
  return Math.max(1, Math.min(policy.maxBatchBounds / 4, policy.spatialCellTargetSize))
}

export function spatialDiameterOf(node: MeshNode): number {
  const scale = node.transform.scale
  return (
    geometryDiameterOf(node.geometry) *
    Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
  )
}

function geometryDiameterOf(geometry: GeometryDescriptor): number {
  switch (geometry.kind) {
    case 'box':
      return Math.hypot(geometry.width, geometry.height, geometry.depth)
    case 'capsule':
      return geometry.height + geometry.radius * 2
    case 'circle':
    case 'dodecahedron':
    case 'icosahedron':
    case 'octahedron':
    case 'sphere':
    case 'tetrahedron':
      return geometry.radius * 2
    case 'cylinder':
      return Math.hypot(Math.max(geometry.radiusTop, geometry.radiusBottom) * 2, geometry.height)
    case 'plane':
      return Math.hypot(geometry.width, geometry.height)
    case 'ring':
      return geometry.outerRadius * 2
    case 'ribbon': {
      const points = geometry.path.points
      if (points.length === 0) return Math.hypot(geometry.width, geometry.height)
      let lowX = Infinity
      let lowY = Infinity
      let lowZ = Infinity
      let highX = -Infinity
      let highY = -Infinity
      let highZ = -Infinity
      const include = (x: number, y: number, z: number): void => {
        lowX = Math.min(lowX, x)
        lowY = Math.min(lowY, y)
        lowZ = Math.min(lowZ, z)
        highX = Math.max(highX, x)
        highY = Math.max(highY, y)
        highZ = Math.max(highZ, z)
      }
      for (const [index, point] of points.entries()) {
        include(point.x, point.y, point.z)
        if (geometry.path.kind !== 'bezier') continue
        const handles = geometry.path.handles[index]
        if (!handles) continue
        include(point.x + handles.in.x, point.y + handles.in.y, point.z + handles.in.z)
        include(point.x + handles.out.x, point.y + handles.out.y, point.z + handles.out.z)
      }
      return Math.hypot(
        highX - lowX + geometry.width,
        highY - lowY + geometry.height,
        highZ - lowZ + geometry.width,
      )
    }
    case 'torus':
    case 'torusKnot':
      return (geometry.radius + geometry.tube) * 2
    case 'tube':
      return (1 + geometry.radius) * 2
    case 'lathe':
      return 4
  }
}

function geometryCostOf(geometry: GeometryDescriptor): number {
  switch (geometry.kind) {
    case 'sphere':
      return Math.max(1, (geometry.widthSegments * geometry.heightSegments) / 12)
    case 'torus':
    case 'torusKnot':
      return Math.max(1, (geometry.radialSegments * geometry.tubularSegments) / 12)
    case 'tube':
      return Math.max(1, (geometry.radialSegments * geometry.tubularSegments) / 12)
    case 'capsule':
      return Math.max(1, (geometry.capSegments * geometry.radialSegments) / 12)
    case 'cylinder':
    case 'circle':
    case 'ring':
    case 'lathe':
      return Math.max(1, geometry.segments / 12)
    case 'ribbon':
      return Math.max(1, geometry.segments / 12)
    default:
      return 1
  }
}
