import { InstancedMesh, Matrix4, Object3D } from 'three'
import type { Lot } from './worldBodies'

/**
 * Q3 : les corps MOBILES, hors des cellules statiques.
 *
 * 🛑 C5-B1 a mesuré pourquoi il le faut : vingt changements de cellule par frame refaisaient près
 * de mille `InstancedMesh`, 17,5 ms, parce qu'un lot statique est un tableau contigu — en retirer
 * une matrice au milieu décale tout et la cellule entière est reconstruite.
 *
 * Ici un corps garde son SLOT toute sa vie, sa matrice se réécrit en place, et un retrait échange
 * avec le dernier occupant plutôt que de décaler. Aucun lot n'est jamais reconstruit.
 */

const AT = new Matrix4()

export type DynamicLayer = {
  meshes: InstancedMesh[]
  objects: Object3D[]
  /** Place un corps neuf dans le lot voulu et rend son identifiant, ou −1 si le lot est plein. */
  add: (lot: number, matrix: Matrix4) => number
  /** Réécrit la matrice d'un corps. O(1), aucune reconstruction. */
  move: (lot: number, id: number, matrix: Matrix4) => void
  /** Retire par échange avec le dernier : le lot reste contigu sans qu'on décale rien. */
  remove: (lot: number, id: number) => number
  /** Pousse au GPU les plages touchées depuis le dernier appel. */
  flush: () => void
  counts: () => number[]
  bytes: number
}

export function createDynamicLayer(lots: Lot[], capacityPerLot: number): DynamicLayer {
  const meshes: InstancedMesh[] = []
  const live: number[] = []
  const touchedFrom: number[] = []
  const touchedTo: number[] = []
  let bytes = 0

  for (const lot of lots) {
    const mesh = new InstancedMesh(lot.geometry, lot.material, capacityPerLot)
    mesh.matrixAutoUpdate = false
    // Le compte réel porte ce qui est dessiné ; la capacité, elle, est réservée une fois.
    mesh.count = 0
    // Les mobiles vont partout : une sphère englobante calculée une fois serait fausse au premier
    // pas. La partition statique ne les tient pas, et le frustum les garde tous.
    mesh.frustumCulled = false
    meshes.push(mesh)
    live.push(0)
    touchedFrom.push(Infinity)
    touchedTo.push(-1)
    bytes += capacityPerLot * 64
  }

  const touch = (lot: number, id: number): void => {
    if (id < (touchedFrom[lot] ?? Infinity)) touchedFrom[lot] = id
    if (id > (touchedTo[lot] ?? -1)) touchedTo[lot] = id
  }

  return {
    meshes,
    objects: meshes,
    add: (lot, matrix) => {
      const mesh = meshes[lot]
      const at = live[lot] ?? 0
      if (!mesh || at >= mesh.instanceMatrix.count) return -1
      mesh.setMatrixAt(at, matrix)
      live[lot] = at + 1
      mesh.count = at + 1
      touch(lot, at)
      return at
    },
    move: (lot, id, matrix) => {
      meshes[lot]?.setMatrixAt(id, matrix)
      touch(lot, id)
    },
    remove: (lot, id) => {
      const mesh = meshes[lot]
      const last = (live[lot] ?? 1) - 1
      if (!mesh || last < 0) return -1
      if (id !== last) {
        mesh.getMatrixAt(last, AT)
        mesh.setMatrixAt(id, AT)
        touch(lot, id)
      }
      live[lot] = last
      mesh.count = last
      // Rend le rang du corps qui a pris la place, pour que l'appelant tienne sa table à jour.
      return id !== last ? last : -1
    },
    flush: () => {
      for (const [lot, mesh] of meshes.entries()) {
        const from = touchedFrom[lot] ?? Infinity
        const to = touchedTo[lot] ?? -1
        if (to < from) continue
        // 🛑 Une PLAGE, jamais le tampon entier : `needsUpdate` global ré-enverrait la capacité
        // complète de chaque lot à chaque frame.
        mesh.instanceMatrix.clearUpdateRanges()
        mesh.instanceMatrix.addUpdateRange(from * 16, (to - from + 1) * 16)
        mesh.instanceMatrix.needsUpdate = true
        touchedFrom[lot] = Infinity
        touchedTo[lot] = -1
      }
    },
    counts: () => [...live],
    bytes,
  }
}
