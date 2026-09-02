import type { CellKey, CellPlan } from './cellInstancing'

/**
 * Ce que les deux candidats doivent savoir faire, et rien de plus.
 *
 * Le frustum n'entre PAS ici : l'index répond « quelles cellules touchent ce disque », le banc
 * applique la vue ensuite. Un index qui culerait lui-même ne se comparerait plus à l'autre.
 */
export type SpatialIndex = {
  name: string
  /** Les cellules dont une part tombe dans le disque. Remplit `into` plutôt que d'allouer. */
  query: (x: number, z: number, radius: number, into: CellKey[]) => void
  /** Un corps a bougé : le retirer de sa cellule, l'ajouter à la nouvelle. */
  update: (slot: number, fromKey: CellKey, toKey: CellKey) => void
  stats: () => { nodesVisited: number; cellsReturned: number }
  /** Ce que l'index occupe, en octets, hors corps et hors meshes. */
  footprint: () => number
  built: { ms: number }
}

/** La cellule d'un point, dans le repère de la grille d'instancing. */
export const cellAt = (plan: CellPlan, x: number, z: number): { cx: number; cz: number } => ({
  cx: Math.floor((x - plan.low.x) / plan.cellSize),
  cz: Math.floor((z - plan.low.z) / plan.cellSize),
})

/** Le carré d'une cellule coupe-t-il le disque ? Distance au point le plus proche du carré. */
export function cellTouches(
  plan: CellPlan,
  cx: number,
  cz: number,
  x: number,
  z: number,
  radius: number,
): boolean {
  const lowX = plan.low.x + cx * plan.cellSize
  const lowZ = plan.low.z + cz * plan.cellSize
  const nearX = Math.max(lowX, Math.min(x, lowX + plan.cellSize))
  const nearZ = Math.max(lowZ, Math.min(z, lowZ + plan.cellSize))
  return (nearX - x) ** 2 + (nearZ - z) ** 2 <= radius * radius
}
