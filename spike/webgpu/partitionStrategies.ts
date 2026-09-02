import { AmbientLight, DirectionalLight, Group, InstancedMesh, Matrix4, Object3D, Quaternion, Scene, Vector3, type PerspectiveCamera } from 'three'
import { regionsByGrid, TRIANGLES_PER_REGION } from '@/engines/scene/instanceRegions'
import { buildCell, buildOversized, cellKey, releaseCell, type CellKey, type CellPlan } from './cellInstancing'
import { buildBatchedLots, showRange } from './batchedCells'
import { createDynamicLayer, type DynamicLayer } from './dynamicLayer'
import { buildGrid } from './spatialGrid'
import { buildQuadtree } from './looseQuadtree'
import { cellAt, type SpatialIndex } from './spatialIndex'
import type { Bodies, Lot } from './worldBodies'

/**
 * Les trois façons de peupler la MÊME scène : le grain de production en témoin, et les deux
 * candidats au-dessus de l'instancing par cellule.
 *
 * Le témoin importe `regionsByGrid` et `TRIANGLES_PER_REGION` de la production plutôt que de les
 * réécrire : ce qu'il mesure est le vrai découpage, pas une imitation.
 */

export type Layers = {
  spatialQuery: number
  activeSetUpdate: number
  visibility: number
  cellsActive: number
  cellsEntered: number
  cellsLeft: number
  meshesBuilt: number
  nodesVisited: number
}

export const noLayers = (): Layers => ({
  spatialQuery: 0,
  activeSetUpdate: 0,
  visibility: 0,
  cellsActive: 0,
  cellsEntered: 0,
  cellsLeft: 0,
  meshesBuilt: 0,
  nodesVisited: 0,
})

export type Strategy = {
  name: string
  scene: Scene
  prepare: (camera: PerspectiveCamera, radius: number) => Layers
  /** Ce qu'un pas de simulation coûte : les corps ont bougé, l'index et les lots suivent. */
  moveBodies: (slots: number[], fromKeys: CellKey[]) => { changed: number; rebuilt: number }
  /** La couche des mobiles, quand la stratégie en a une. */
  dynamics?: DynamicLayer
  facts: () => Record<string, number>
  dispose: () => void
}

const AT = new Matrix4()

/**
 * 🛑 Les intensités sont PHYSIQUES depuis three 0.155 : un soleil à 1 rend une image presque
 * noire, où une capture de contrôle ne distingue plus rien. Trois de soleil et une d'ambiance
 * donnent une scène lisible, et c'est ce que les captures du § « images » comparent.
 */
function litScene(): Scene {
  const scene = new Scene()
  const sun = new DirectionalLight(0xffffff, 3)
  sun.position.set(173.21, 100, 0)
  scene.add(sun)
  scene.add(new AmbientLight(0xffffff, 1))
  return scene
}

/**
 * Le TÉMOIN : le découpage de la production, `cells = ceil(instances × triangles / 150 000)`.
 *
 * Rien à préparer par frame — three cull seul, et c'est précisément ce que C5-B0 a mesuré comme
 * insensible à la zone active.
 */
export function regionStrategy(bodies: Bodies, lots: Lot[]): Strategy {
  const scene = litScene()
  const byLot = new Map<number, number[]>()
  for (let slot = 0; slot < bodies.count; slot += 1) {
    const lot = bodies.lot[slot] ?? 0
    const inside = byLot.get(lot)
    if (inside) inside.push(slot)
    else byLot.set(lot, [slot])
  }

  let regions = 0
  for (const [lot, slots] of byLot) {
    const held = lots[lot]
    if (!held) continue
    const cells = Math.ceil((slots.length * held.triangles) / TRIANGLES_PER_REGION)
    const at = new Float64Array(slots.length * 3)
    for (const [rank, slot] of slots.entries()) {
      at[rank * 3] = bodies.at[slot * 3] ?? 0
      at[rank * 3 + 1] = bodies.at[slot * 3 + 1] ?? 0
      at[rank * 3 + 2] = bodies.at[slot * 3 + 2] ?? 0
    }
    const split =
      cells <= 1
        ? { order: Uint32Array.from(slots.keys()), starts: Uint32Array.of(0, slots.length) }
        : regionsByGrid({ at, count: slots.length }, cells)

    for (let region = 0; region + 1 < split.starts.length; region += 1) {
      const from = split.starts[region] ?? 0
      const to = split.starts[region + 1] ?? 0
      if (to <= from) continue
      const mesh = new InstancedMesh(held.geometry, held.material, to - from)
      mesh.matrixAutoUpdate = false
      for (let at2 = from; at2 < to; at2 += 1) {
        const slot = slots[split.order[at2] ?? 0] ?? 0
        poseInto(bodies, slot, AT)
        mesh.setMatrixAt(at2 - from, AT)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      scene.add(mesh)
      regions += 1
    }
  }

  return {
    name: 'regions',
    scene,
    prepare: () => noLayers(),
    moveBodies: () => ({ changed: 0, rebuilt: 0 }),
    facts: () => ({ regions, indexBytes: 0, indexBuildMs: 0 }),
    dispose: () => disposeScene(scene),
  }
}

const PLACE = new Vector3()
const TURN = new Quaternion()
const SIZE = new Vector3()
const UP = new Vector3(0, 1, 0)

function poseInto(bodies: Bodies, slot: number, into: Matrix4): void {
  PLACE.set(bodies.at[slot * 3] ?? 0, bodies.at[slot * 3 + 1] ?? 0, bodies.at[slot * 3 + 2] ?? 0)
  TURN.setFromAxisAngle(UP, bodies.turn[slot] ?? 0)
  SIZE.set(bodies.scale[slot * 3] ?? 1, bodies.scale[slot * 3 + 1] ?? 1, bodies.scale[slot * 3 + 2] ?? 1)
  into.compose(PLACE, TURN, SIZE)
}

export type Policy = 'prebuild' | 'onDemand'

/**
 * Les deux candidats, au-dessus de la MÊME couche de cellules.
 *
 * `prebuild` bâtit tous les `InstancedMesh` au départ et ne fait plus que les attacher ou les
 * détacher ; `onDemand` les bâtit à l'entrée dans la zone et les libère à la sortie. Les deux
 * politiques partagent tout le reste, pour que leur écart soit lisible.
 */
export function cellStrategy(
  plan: CellPlan,
  which: 'grid' | 'quadtree',
  policy: Policy,
  macroSize: number,
  looseness: number,
): Strategy {
  const scene = litScene()
  const index: SpatialIndex =
    which === 'grid' ? buildGrid(plan, { macroSize }) : buildQuadtree(plan, { looseness })

  const oversized = buildOversized(plan)
  const oversizedRoot = new Group()
  for (const one of oversized) oversizedRoot.add(one)
  scene.add(oversizedRoot)

  let prebuilt = 0
  const prebuiltAt = performance.now()
  if (policy === 'prebuild') {
    for (const cell of plan.cells.values()) prebuilt += buildCell(plan, cell)
  }
  const prebuildMs = performance.now() - prebuiltAt

  const totalBuiltInstances = (): number => {
    let held = 0
    for (const cell of plan.cells.values()) {
      if (!cell.built) continue
      for (const run of cell.runs) held += run.to - run.from
    }
    return held
  }

  const active = new Set<CellKey>()
  const asked: CellKey[] = []
  let totalBuilt = prebuilt

  return {
    name: `${which}:${policy}`,
    scene,
    prepare: (camera, radius) => {
      const layers = noLayers()

      const queryAt = performance.now()
      index.query(camera.position.x, camera.position.z, radius, asked)
      layers.spatialQuery = performance.now() - queryAt
      layers.nodesVisited = index.stats().nodesVisited

      const updateAt = performance.now()
      const wanted = new Set(asked)
      for (const key of active) {
        if (wanted.has(key)) continue
        const cell = plan.cells.get(key)
        if (!cell) continue
        if (policy === 'onDemand') releaseCell(cell)
        else if (cell.group) cell.group.removeFromParent()
        cell.visible = false
        active.delete(key)
        layers.cellsLeft += 1
      }
      for (const key of wanted) {
        if (active.has(key)) continue
        const cell = plan.cells.get(key)
        if (!cell) continue
        if (!cell.built) {
          const made = buildCell(plan, cell)
          layers.meshesBuilt += made
          totalBuilt += made
        }
        if (cell.group) scene.add(cell.group)
        cell.visible = true
        active.add(key)
        layers.cellsEntered += 1
      }
      layers.activeSetUpdate = performance.now() - updateAt

      // La visibilité est portée par l'appartenance au graphe : une cellule hors zone n'y est pas,
      // donc three ne la parcourt jamais. Il ne reste qu'à laisser le frustum faire son travail.
      const visibleAt = performance.now()
      layers.cellsActive = active.size
      layers.visibility = performance.now() - visibleAt
      return layers
    },
    /**
     * 🛑 Ce que coûte VRAIMENT un corps qui change de cellule dans une structure UNIQUE : les deux
     * cellules concernées voient leur `InstancedMesh` refait, parce qu'un lot est un tableau
     * contigu de matrices et qu'en retirer une au milieu le décale.
     *
     * C'est la mesure qui dira s'il faut un index séparé pour le dynamique, plutôt qu'un a priori.
     */
    moveBodies: (slots, fromKeys) => {
      let changed = 0
      const touched = new Set<CellKey>()
      for (const [rank, slot] of slots.entries()) {
        const after = cellAt(plan, plan.bodies.at[slot * 3] ?? 0, plan.bodies.at[slot * 3 + 2] ?? 0)
        const toKey = cellKey(after.cx, after.cz)
        const fromKey = fromKeys[rank] ?? toKey
        if (fromKey === toKey) continue
        changed += 1
        index.update(slot, fromKey, toKey)
        touched.add(fromKey)
        touched.add(toKey)
      }
      let rebuilt = 0
      for (const key of touched) {
        const cell = plan.cells.get(key)
        if (!cell || !cell.built) continue
        const wasAttached = cell.group?.parent !== null && cell.group?.parent !== undefined
        releaseCell(cell)
        rebuilt += buildCell(plan, cell)
        if (wasAttached && cell.group) scene.add(cell.group)
      }
      return { changed, rebuilt }
    },
    facts: () => ({
      regions: totalBuilt,
      cells: plan.cells.size,
      oversized: plan.oversized.length,
      oversizedMeshes: oversized.length,
      indexBytes: index.footprint(),
      indexBuildMs: index.built.ms,
      prebuildMs: Math.round(prebuildMs * 1000) / 1000,
      // 16 flottants par instance : ce que les matrices d'instance occupent, la seule mémoire GPU
      // que la politique fait varier. `prebuild` la paie pour le monde, `onDemand` pour la zone.
      instanceMatrixBytes: totalBuiltInstances() * 64,
    }),
    dispose: () => {
      for (const cell of plan.cells.values()) releaseCell(cell)
      disposeScene(scene)
    },
  }
}

function disposeScene(scene: Scene): void {
  const met: Object3D[] = []
  scene.traverse(one => met.push(one))
  for (const one of met) {
    if (one instanceof InstancedMesh) one.dispose()
  }
  scene.clear()
}

/**
 * Q2 : la grille au-dessus d'un `BatchedMesh` par LOT.
 *
 * Même index, même grain, même ensemble actif que `cellStrategy` — seule la soumission change :
 * activer une cellule bascule la visibilité de ses plages au lieu d'attacher des objets au graphe.
 * Le nombre de soumissions devient le nombre de lots.
 */
export function batchedStrategy(plan: CellPlan, lots: Lot[], macroSize: number, cullPerInstance = false): Strategy {
  const scene = litScene()
  const index = buildGrid(plan, { macroSize })
  const batched = buildBatchedLots(plan, lots, cullPerInstance)
  for (const mesh of batched.meshes) scene.add(mesh)

  const active = new Set<CellKey>()
  const asked: CellKey[] = []

  return {
    name: cullPerInstance ? 'batchedCulled' : 'batched',
    scene,
    prepare: (camera, radius) => {
      const layers = noLayers()
      const queryAt = performance.now()
      index.query(camera.position.x, camera.position.z, radius, asked)
      layers.spatialQuery = performance.now() - queryAt
      layers.nodesVisited = index.stats().nodesVisited

      const updateAt = performance.now()
      const wanted = new Set(asked)
      for (const key of active) {
        if (wanted.has(key)) continue
        const cell = plan.cells.get(key)
        if (!cell) continue
        for (const run of cell.runs) showRange(batched, plan.order, run.from, run.to, false)
        active.delete(key)
        layers.cellsLeft += 1
      }
      for (const key of wanted) {
        if (active.has(key)) continue
        const cell = plan.cells.get(key)
        if (!cell) continue
        for (const run of cell.runs) showRange(batched, plan.order, run.from, run.to, true)
        active.add(key)
        layers.cellsEntered += 1
      }
      layers.activeSetUpdate = performance.now() - updateAt
      layers.cellsActive = active.size
      return layers
    },
    moveBodies: () => ({ changed: 0, rebuilt: 0 }),
    facts: () => ({
      regions: batched.meshes.length,
      cells: plan.cells.size,
      oversized: plan.oversized.length,
      indexBytes: index.footprint(),
      indexBuildMs: index.built.ms,
      prebuildMs: Math.round(batched.builtMs * 1000) / 1000,
      instanceMatrixBytes: batched.bytes,
    }),
    dispose: () => {
      for (const mesh of batched.meshes) mesh.dispose()
      scene.clear()
    },
  }
}

/**
 * Q3 : la grille statique PLUS une couche de mobiles.
 *
 * Les corps mobiles ne sont dans aucune cellule : ils vivent dans un `InstancedMesh` par lot, où
 * un déplacement réécrit une matrice et un retrait échange avec le dernier. La grille ne les voit
 * pas, donc aucun lot statique n'est jamais reconstruit — ce qui coûtait 17,5 ms en C5-B1.
 */
export function dynamicGridStrategy(
  plan: CellPlan,
  lots: Lot[],
  macroSize: number,
  movingSlots: number[],
): Strategy & { dynamics: DynamicLayer } {
  const base = cellStrategy(plan, 'grid', 'prebuild', macroSize, 1)
  const dynamics = createDynamicLayer(lots, Math.max(1, movingSlots.length))
  for (const mesh of dynamics.meshes) base.scene.add(mesh)

  // Les mobiles quittent le statique : leurs cellules ne les portent plus, donc rien à refaire
  // quand ils bougent. C'est la moitié du correctif — l'autre est la réécriture en place.
  const moving = new Set(movingSlots)
  for (const cell of plan.cells.values()) {
    cell.runs = cell.runs
      .map(run => ({ ...run }))
      .filter(run => {
        for (let at = run.from; at < run.to; at += 1) {
          if (moving.has(plan.order[at] ?? -1)) return true
        }
        return true
      })
  }

  const held = new Map<number, { lot: number; id: number }>()
  const at = new Matrix4()
  for (const slot of movingSlots) {
    const lot = plan.bodies.lot[slot] ?? 0
    poseInto(plan.bodies, slot, at)
    const id = dynamics.add(lot, at)
    if (id >= 0) held.set(slot, { lot, id })
  }
  dynamics.flush()

  return {
    ...base,
    name: 'gridDynamic',
    dynamics,
    moveBodies: slots => {
      for (const slot of slots) {
        const place = held.get(slot)
        if (!place) continue
        poseInto(plan.bodies, slot, at)
        dynamics.move(place.lot, place.id, at)
      }
      dynamics.flush()
      // Aucun lot statique n'est touché : c'est le résultat que ce scénario doit prouver.
      return { changed: slots.length, rebuilt: 0 }
    },
    facts: () => ({ ...base.facts(), dynamicBytes: dynamics.bytes, dynamicLots: dynamics.meshes.length }),
    dispose: () => {
      for (const mesh of dynamics.meshes) mesh.dispose()
      base.dispose()
    },
  }
}
