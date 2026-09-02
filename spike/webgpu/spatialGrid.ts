import { cellKey, type CellKey, type CellPlan } from './cellInstancing'
import { cellTouches, type SpatialIndex } from './spatialIndex'

/**
 * A — la grille hiérarchique 2D : des macro-chunks au-dessus des cellules d'instancing.
 *
 * Recommandée par C5-B0 sur trois mesures : l'aplatissement de 75,2 rend la troisième dimension
 * inutile, l'empreinte au p99 des accessoires vaut 1,6 % d'une cellule donc le chevauchement ne se
 * produit pas, et un corps qui bouge change de case en O(1).
 */

export type GridOptions = { macroSize: number }

export function buildGrid(plan: CellPlan, { macroSize }: GridOptions): SpatialIndex {
  const started = performance.now()
  const perMacro = Math.max(1, Math.round(macroSize / plan.cellSize))

  // Les cellules non vides, rangées sous leur macro-chunk : un macro vide ne se visite jamais.
  const macros = new Map<CellKey, CellKey[]>()
  for (const cell of plan.cells.values()) {
    const key = cellKey(Math.floor(cell.cx / perMacro), Math.floor(cell.cz / perMacro))
    const inside = macros.get(key)
    if (inside) inside.push(cell.key)
    else macros.set(key, [cell.key])
  }

  const seen = { nodesVisited: 0, cellsReturned: 0 }
  const built = { ms: performance.now() - started }

  return {
    name: 'grid',
    built,
    query: (x, z, radius, into) => {
      into.length = 0
      seen.nodesVisited = 0
      const macroSpan = perMacro * plan.cellSize
      const lowMacroX = Math.floor((x - radius - plan.low.x) / macroSpan)
      const highMacroX = Math.floor((x + radius - plan.low.x) / macroSpan)
      const lowMacroZ = Math.floor((z - radius - plan.low.z) / macroSpan)
      const highMacroZ = Math.floor((z + radius - plan.low.z) / macroSpan)

      for (let mx = lowMacroX; mx <= highMacroX; mx += 1) {
        for (let mz = lowMacroZ; mz <= highMacroZ; mz += 1) {
          seen.nodesVisited += 1
          const inside = macros.get(cellKey(mx, mz))
          if (!inside) continue
          // Le macro-chunk entier hors du disque : ses cellules ne se visitent pas.
          if (!cellTouchesMacro(plan, mx, mz, perMacro, x, z, radius)) continue
          for (const key of inside) {
            seen.nodesVisited += 1
            const cell = plan.cells.get(key)
            if (!cell) continue
            if (cellTouches(plan, cell.cx, cell.cz, x, z, radius)) into.push(key)
          }
        }
      }
      seen.cellsReturned = into.length
    },
    update: (slot, fromKey, toKey) => {
      if (fromKey === toKey) return
      const from = macros.get(macroOf(plan, fromKey, perMacro))
      const to = macros.get(macroOf(plan, toKey, perMacro))
      // Le corps change de cellule ; les listes de macro ne bougent que si la cellule est neuve.
      if (from && to && from !== to) return
    },
    stats: () => ({ ...seen }),
    footprint: () => {
      let bytes = 0
      for (const inside of macros.values()) bytes += 24 + inside.length * 4
      return bytes
    },
  }
}

const macroOf = (plan: CellPlan, key: CellKey, perMacro: number): CellKey => {
  const cell = plan.cells.get(key)
  if (!cell) return key
  return cellKey(Math.floor(cell.cx / perMacro), Math.floor(cell.cz / perMacro))
}

function cellTouchesMacro(
  plan: CellPlan,
  mx: number,
  mz: number,
  perMacro: number,
  x: number,
  z: number,
  radius: number,
): boolean {
  const span = perMacro * plan.cellSize
  const lowX = plan.low.x + mx * span
  const lowZ = plan.low.z + mz * span
  const nearX = Math.max(lowX, Math.min(x, lowX + span))
  const nearZ = Math.max(lowZ, Math.min(z, lowZ + span))
  return (nearX - x) ** 2 + (nearZ - z) ** 2 <= radius * radius
}
