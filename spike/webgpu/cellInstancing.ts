import { Group, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import type { Bodies, Lot } from './worldBodies'

/**
 * L'instancing PAR CELLULE — la couche que A et B partagent, et la raison du gain attendu.
 *
 * 🛑 Le défaut mesuré en C5-B0 vient de ce que la production découpe sur un budget de TRIANGLES :
 * 19 régions de cubes couvraient le monde entier et dessinaient leurs 178 261 instances quelle que
 * soit la vue. Ici le grain est SPATIAL et fixe — une grille régulière de `cellSize` — donc un lot
 * ne peut jamais s'étendre au-delà d'une cellule.
 *
 * A et B ne sont que deux façons de RETROUVER ces cellules. Elles ne redéfinissent pas le grain,
 * sans quoi le duel comparerait deux découpages au lieu de deux index.
 */

export type CellKey = number

/** Une cellule tient un `Group` par cellule et un `InstancedMesh` par lot présent dedans. */
export type Cell = {
  key: CellKey
  cx: number
  cz: number
  /** Les rangs des corps qu'elle tient, groupés par lot : `[lot, début, fin]` par tranche. */
  runs: { lot: number; from: number; to: number }[]
  group: Group | null
  /** Bâtie ? Une cellule à la demande ne l'est qu'en entrant dans la zone active. */
  built: boolean
  visible: boolean
}

export type CellPlan = {
  cellSize: number
  perAxis: number
  low: { x: number; z: number }
  cells: Map<CellKey, Cell>
  /** Les rangs triés par (cellule, lot) : chaque tranche d'une cellule est contiguë. */
  order: Uint32Array
  /** Ce qui déborde d'une cellule et se teste tout seul. */
  oversized: number[]
  bodies: Bodies
  lots: Lot[]
}

export const cellKey = (cx: number, cz: number): CellKey => cx * 65536 + cz

const AT = new Matrix4()
const PLACE = new Vector3()
const TURN = new Quaternion()
const SIZE = new Vector3()
const UP = new Vector3(0, 1, 0)

/**
 * Range les corps par cellule puis par lot, en un seul tri.
 *
 * Un corps dont l'empreinte dépasse la moitié d'une cellule part dans `oversized` : il serait à
 * cheval sur plusieurs cellules, et le ranger dans une seule ferait disparaître son ombre portée
 * hors de celle-ci. C'est le « loose » d'un loose quadtree, ramené à une liste.
 */
export function planCells(bodies: Bodies, lots: Lot[], cellSize: number): CellPlan {
  let lowX = Infinity
  let lowZ = Infinity
  let highX = -Infinity
  let highZ = -Infinity
  for (let slot = 0; slot < bodies.count; slot += 1) {
    const x = bodies.at[slot * 3] ?? 0
    const z = bodies.at[slot * 3 + 2] ?? 0
    if (x < lowX) lowX = x
    if (x > highX) highX = x
    if (z < lowZ) lowZ = z
    if (z > highZ) highZ = z
  }
  const perAxis = Math.max(1, Math.ceil((highX - lowX) / cellSize))

  const oversized: number[] = []
  const held = new Map<CellKey, number[]>()
  for (let slot = 0; slot < bodies.count; slot += 1) {
    if ((bodies.reach[slot] ?? 0) > cellSize / 2) {
      oversized.push(slot)
      continue
    }
    const cx = Math.floor(((bodies.at[slot * 3] ?? 0) - lowX) / cellSize)
    const cz = Math.floor(((bodies.at[slot * 3 + 2] ?? 0) - lowZ) / cellSize)
    const key = cellKey(cx, cz)
    const inside = held.get(key)
    if (inside) inside.push(slot)
    else held.set(key, [slot])
  }

  const order = new Uint32Array(bodies.count)
  const cells = new Map<CellKey, Cell>()
  let written = 0
  for (const [key, slots] of held) {
    slots.sort((one, other) => (bodies.lot[one] ?? 0) - (bodies.lot[other] ?? 0))
    const runs: { lot: number; from: number; to: number }[] = []
    let runLot = -1
    let runFrom = written
    for (const slot of slots) {
      const lot = bodies.lot[slot] ?? 0
      if (lot !== runLot) {
        if (runLot >= 0) runs.push({ lot: runLot, from: runFrom, to: written })
        runLot = lot
        runFrom = written
      }
      order[written] = slot
      written += 1
    }
    if (runLot >= 0) runs.push({ lot: runLot, from: runFrom, to: written })
    cells.set(key, {
      key,
      cx: Math.floor(key / 65536),
      cz: key % 65536,
      runs,
      group: null,
      built: false,
      visible: false,
    })
  }

  return { cellSize, perAxis, low: { x: lowX, z: lowZ }, cells, order, oversized, bodies, lots }
}

/** Écrit la matrice du corps `slot` dans `into`. */
function poseOf(bodies: Bodies, slot: number, into: Matrix4): void {
  PLACE.set(bodies.at[slot * 3] ?? 0, bodies.at[slot * 3 + 1] ?? 0, bodies.at[slot * 3 + 2] ?? 0)
  TURN.setFromAxisAngle(UP, bodies.turn[slot] ?? 0)
  SIZE.set(bodies.scale[slot * 3] ?? 1, bodies.scale[slot * 3 + 1] ?? 1, bodies.scale[slot * 3 + 2] ?? 1)
  into.compose(PLACE, TURN, SIZE)
}

/** Bâtit les `InstancedMesh` d'une cellule. Idempotent : une cellule déjà bâtie ne repaie rien. */
export function buildCell(plan: CellPlan, cell: Cell): number {
  if (cell.built) return 0
  const group = new Group()
  group.matrixAutoUpdate = false
  let made = 0
  for (const run of cell.runs) {
    const lot = plan.lots[run.lot]
    if (!lot) continue
    const mesh = new InstancedMesh(lot.geometry, lot.material, run.to - run.from)
    mesh.matrixAutoUpdate = false
    for (let at = run.from; at < run.to; at += 1) {
      poseOf(plan.bodies, plan.order[at] ?? 0, AT)
      mesh.setMatrixAt(at - run.from, AT)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    group.add(mesh)
    made += 1
  }
  cell.group = group
  cell.built = true
  return made
}

/** Libère les `InstancedMesh` d'une cellule — la politique « à la demande » les rend à leur sortie. */
export function releaseCell(cell: Cell): void {
  if (!cell.group) return
  for (const child of cell.group.children) {
    if (child instanceof InstancedMesh) child.dispose()
  }
  cell.group.removeFromParent()
  cell.group = null
  cell.built = false
  cell.visible = false
}

/** Les corps surdimensionnés, dessinés chacun pour soi : ils débordent de toute cellule. */
export function buildOversized(plan: CellPlan): Object3D[] {
  const made: Object3D[] = []
  const byLot = new Map<number, number[]>()
  for (const slot of plan.oversized) {
    const lot = plan.bodies.lot[slot] ?? 0
    const inside = byLot.get(lot)
    if (inside) inside.push(slot)
    else byLot.set(lot, [slot])
  }
  for (const [lot, slots] of byLot) {
    const held = plan.lots[lot]
    if (!held) continue
    const mesh = new InstancedMesh(held.geometry, held.material, slots.length)
    mesh.matrixAutoUpdate = false
    for (const [at, slot] of slots.entries()) {
      poseOf(plan.bodies, slot, AT)
      mesh.setMatrixAt(at, AT)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    made.push(mesh)
  }
  return made
}

/** Le centre d'une cellule en monde, pour la tester contre la zone active. */
export const cellCentre = (plan: CellPlan, cell: Cell): { x: number; z: number } => ({
  x: plan.low.x + (cell.cx + 0.5) * plan.cellSize,
  z: plan.low.z + (cell.cz + 0.5) * plan.cellSize,
})
