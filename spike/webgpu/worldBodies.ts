import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Material } from 'three'
import type { SceneState } from '@/engines/scene/sceneState'
import type { GeometryDescriptor } from '@shared/domain/geometry'

/**
 * Le monde à PLAT : des tableaux typés plutôt qu'un graphe d'objets.
 *
 * C5-B1 bâtit ses propres `InstancedMesh` par cellule, donc il lui faut les corps sous une forme
 * qu'on parcourt sans allouer. Un corps ne porte que ce qui décide de son lot — sa forme, sa
 * peinture — et de sa place.
 */

export type Bodies = {
  count: number
  /** Position, trois nombres par corps. */
  at: Float64Array
  /** Échelle, trois nombres par corps. */
  scale: Float32Array
  /** Rotation autour de Y, la seule que ce monde donne. */
  turn: Float32Array
  /** Le lot auquel il appartient : une paire (géométrie, matériau) déjà résolue. */
  lot: Uint16Array
  /** Demi-empreinte au sol, pour savoir si un corps déborde de sa cellule. */
  reach: Float32Array
}

export type Lot = { key: string; geometry: BufferGeometry; material: Material; triangles: number }

const keyOfGeometry = (geometry: GeometryDescriptor): string => {
  if (geometry.kind === 'sphere') return `sphere:${geometry.widthSegments}x${geometry.heightSegments}`
  if (geometry.kind === 'cylinder') return `cyl:${geometry.segments}`
  return geometry.kind
}

function buildGeometry(geometry: GeometryDescriptor): BufferGeometry {
  if (geometry.kind === 'sphere') {
    return new SphereGeometry(geometry.radius, geometry.widthSegments, geometry.heightSegments)
  }
  if (geometry.kind === 'cylinder') {
    return new CylinderGeometry(geometry.radiusTop, geometry.radiusBottom, geometry.height, geometry.segments)
  }
  return new BoxGeometry(1, 1, 1)
}

const trianglesOf = (geometry: BufferGeometry): number =>
  (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3

/**
 * Les corps et leurs lots, tirés de l'état du studio.
 *
 * Le lot est la paire (géométrie, matériau) — exactement ce sur quoi la production regroupe, donc
 * le témoin et les deux candidats partagent le même découpage en lots et ne diffèrent QUE par
 * l'espace.
 */
export function bodiesOf(state: SceneState): { bodies: Bodies; lots: Lot[] } {
  const meshes = state.nodes.filter(node => node.type === 'mesh')
  const bodies: Bodies = {
    count: meshes.length,
    at: new Float64Array(meshes.length * 3),
    scale: new Float32Array(meshes.length * 3),
    turn: new Float32Array(meshes.length),
    lot: new Uint16Array(meshes.length),
    reach: new Float32Array(meshes.length),
  }
  const lots: Lot[] = []
  const known = new Map<string, number>()

  for (const [slot, node] of meshes.entries()) {
    if (node.type !== 'mesh') continue
    const key = `${keyOfGeometry(node.geometry)}|${node.material.color}`
    let lot = known.get(key)
    if (lot === undefined) {
      const geometry = buildGeometry(node.geometry)
      lot = lots.length
      lots.push({
        key,
        geometry,
        material: new MeshStandardMaterial({
          color: node.material.color,
          roughness: node.material.roughness,
          metalness: node.material.metalness,
        }),
        triangles: trianglesOf(geometry),
      })
      known.set(key, lot)
    }
    bodies.at[slot * 3] = node.transform.position.x
    bodies.at[slot * 3 + 1] = node.transform.position.y
    bodies.at[slot * 3 + 2] = node.transform.position.z
    bodies.scale[slot * 3] = node.transform.scale.x
    bodies.scale[slot * 3 + 1] = node.transform.scale.y
    bodies.scale[slot * 3 + 2] = node.transform.scale.z
    bodies.turn[slot] = node.transform.rotation.y
    bodies.lot[slot] = lot
    // La demi-diagonale au sol : ce qui décide si un corps déborde de la cellule qui le tient.
    bodies.reach[slot] = Math.hypot(node.transform.scale.x, node.transform.scale.z) / 2
  }
  return { bodies, lots }
}
