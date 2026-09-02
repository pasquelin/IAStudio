import { BatchedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import type { CellPlan } from './cellInstancing'
import type { Lot } from './worldBodies'

/**
 * Q2 de C5-B2 : découpler le nombre de SOUMISSIONS du nombre de cellules.
 *
 * Un `InstancedMesh` par (cellule, lot) fait que le CPU suit `cellules × lots` — mesuré en C5-B1 :
 * 244 meshes contre 91, et le CPU dans le même rapport à 1 % près. Ici un `BatchedMesh` par LOT
 * porte toutes les instances du monde, et une cellule n'est qu'une PLAGE dont on bascule la
 * visibilité. Le compte de soumissions devient le compte de lots, quel que soit le grain.
 *
 * 🛑 C1 avait écarté `BatchedMesh` parce qu'il parcourt chaque instance à chaque passe pour la
 * culler et la trier — 10,4 ms contre 3,1 sur 10 000 corps. Ce que C1 mesurait aussi, et qui rend
 * ce chemin praticable ici : les deux drapeaux rabattus, il passait SOUS l'instance. Et three sort
 * de `onBeforeRender` sans rien parcourir quand ni le tri, ni le culling, ni la visibilité n'ont
 * bougé (`BatchedMesh.js:1522`). La partition rend le culling par instance inutile : c'est
 * exactement la combinaison qui manquait à C1.
 */

const AT = new Matrix4()
const PLACE = new Vector3()
const TURN = new Quaternion()
const SIZE = new Vector3()
const UP = new Vector3(0, 1, 0)

export type BatchedLots = {
  meshes: BatchedMesh[]
  /** L'identifiant d'instance de chaque corps, dans le `BatchedMesh` de son lot. */
  instanceOf: Int32Array
  /** Le lot de chaque corps, pour retrouver son mesh. */
  lotOf: Uint16Array
  bytes: number
  builtMs: number
}

/**
 * Tous les corps, une fois, dans un `BatchedMesh` par lot, tous invisibles au départ.
 *
 * Un lot est une paire (géométrie, matériau) : il n'a donc qu'UNE géométrie, et `addGeometry` n'est
 * appelé qu'une fois par mesh. Regrouper par matériau seul — ce que `BatchedMesh` permet — mettrait
 * plusieurs géométries dans un mesh et diviserait encore les soumissions ; non fait ici, parce que
 * cela change aussi le découpage en lots et casserait la comparaison avec le témoin.
 */
export function buildBatchedLots(plan: CellPlan, lots: Lot[], cullPerInstance = false): BatchedLots {
  const started = performance.now()
  const bodies = plan.bodies

  const counts = new Uint32Array(lots.length)
  for (let slot = 0; slot < bodies.count; slot += 1) counts[bodies.lot[slot] ?? 0] += 1

  const meshes: BatchedMesh[] = []
  let bytes = 0
  for (const [at, lot] of lots.entries()) {
    const many = counts[at] ?? 0
    const vertices = lot.geometry.getAttribute('position')?.count ?? 0
    const indices = lot.geometry.index?.count ?? 0
    const mesh = new BatchedMesh(Math.max(1, many), vertices, indices, lot.material)
    // 🛑 Les deux drapeaux qui décident : sans eux three parcourt chaque instance à chaque passe.
    // La grille a déjà répondu « quelles cellules », le frustum n'a plus rien à trancher ici.
    // `cullPerInstance` remet le culling que la partition rendait inutile : regrouper par lot fait
    // perdre le frustum par cellule, et c'est lui qui faisait passer 45 789 instances à 20 462.
    mesh.perObjectFrustumCulled = cullPerInstance
    mesh.sortObjects = false
    // Le mesh couvre le monde : le culler globalement le ferait disparaître dès que son centre
    // sort du champ, alors que ses instances visibles sont sous les yeux.
    mesh.frustumCulled = false
    mesh.addGeometry(lot.geometry)
    meshes.push(mesh)
    bytes += many * 64 + vertices * 32 + indices * 4
  }

  const instanceOf = new Int32Array(bodies.count)
  const lotOf = new Uint16Array(bodies.count)
  for (let slot = 0; slot < bodies.count; slot += 1) {
    const lot = bodies.lot[slot] ?? 0
    const mesh = meshes[lot]
    if (!mesh) continue
    const id = mesh.addInstance(0)
    PLACE.set(bodies.at[slot * 3] ?? 0, bodies.at[slot * 3 + 1] ?? 0, bodies.at[slot * 3 + 2] ?? 0)
    TURN.setFromAxisAngle(UP, bodies.turn[slot] ?? 0)
    SIZE.set(bodies.scale[slot * 3] ?? 1, bodies.scale[slot * 3 + 1] ?? 1, bodies.scale[slot * 3 + 2] ?? 1)
    AT.compose(PLACE, TURN, SIZE)
    mesh.setMatrixAt(id, AT)
    mesh.setVisibleAt(id, false)
    instanceOf[slot] = id
    lotOf[slot] = lot
  }

  return { meshes, instanceOf, lotOf, bytes, builtMs: performance.now() - started }
}

/** Bascule la visibilité de tous les corps d'une plage. Aucun tampon n'est recopié. */
export function showRange(
  batched: BatchedLots,
  order: Uint32Array,
  from: number,
  to: number,
  visible: boolean,
): void {
  for (let at = from; at < to; at += 1) {
    const slot = order[at] ?? 0
    batched.meshes[batched.lotOf[slot] ?? 0]?.setVisibleAt(batched.instanceOf[slot] ?? 0, visible)
  }
}
