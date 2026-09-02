import {
  Box3,
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'
import {
  heldOutOfDraw,
  shapeAndPaint,
  sweep,
  worldReach,
  writeMoved,
  type Grouped,
  type GroupingStats,
  type ShadowThrow,
  type InstancedGroups,
  type Placed,
} from './grouping'
import { sameOrder } from '@shared/collections'
import { toRadians } from '@shared/domain/angles'
import { movesOnItsOwn } from '@shared/domain/component'
import { buildPartition, type CellKey, type WorldPartition } from './worldPartition'

/**
 * Draws a repeated shape through one `InstancedMesh` per CELL of the world, and turns off the
 * cells the camera cannot reach.
 *
 * `createInstancedGroups` cuts a group on a budget of TRIANGLES, which says nothing about where
 * the bodies stand: measured on a level of 500 000, 19 regions of cubes covered the whole world
 * and drew their 223 488 instances whatever the view. The grain here is spatial and fixed, so a
 * lot can never spread past one cell — 20 462 instances for the same view, and 2.26 ms of GPU
 * against 2.86.
 *
 * 🛑 A mesh is the unit of culling, and reducing the meshes costs more than it gives back:
 * measured three times, one `BatchedMesh` per lot draws 45 789 instances where this draws 20 462.
 * See RAPPORT-C5B2 § 3.
 */
export function createCellGroups(
  host: Object3D,
  ownMaterialOf: (mesh: Mesh) => Material | Material[] = mesh => mesh.material,
): InstancedGroups {
  const index = buildPartition()
  /** One `Group` per cell, hung under the host: a zone is one flag per cell, not one per body. */
  const cells = new Map<CellKey, Held>()
  /** What each (group, cell) draws, held so a rebuild that did not touch it pays nothing. */
  const buckets = new Map<string, Bucket>()
  const placed: Placed = new Map()
  const sources = heldOutOfDraw()
  const keyOf = shapeAndPaint()
  const near: CellKey[] = []
  /** The cells the host currently holds, and a scratch set so a frame allocates neither. */
  const standing = new Set<CellKey>()
  const wanted = new Set<CellKey>()
  let listed: InstancedMesh[] = []
  let listStale = true

  const groupOf = (cell: CellKey | null): Object3D => {
    if (cell === null) return host
    const known = cells.get(cell)
    if (known) {
      known.stale = true
      return known.group
    }
    const group = new Group()
    group.matrixAutoUpdate = false
    host.add(group)
    cells.set(cell, { group, box: new Box3(), stale: true })
    standing.add(cell)
    index.hold(cell)
    return group
  }

  const drop = (name: string, bucket: Bucket): void => {
    // Only where it still points here: a node this pass moved to another bucket was written
    // before this one was dropped, and deleting by id alone would lose it.
    for (const id of bucket.ids) if (placed.get(id)?.instance === bucket.mesh) placed.delete(id)
    bucket.mesh.removeFromParent()
    bucket.mesh.dispose()
    buckets.delete(name)
    listStale = true
    if (bucket.cell === null) return
    const held = cells.get(bucket.cell)
    if (!held) return
    held.stale = true
    if (held.group.children.length > 0) return
    held.group.removeFromParent()
    cells.delete(bucket.cell)
    standing.delete(bucket.cell)
    index.release(bucket.cell)
  }

  const settle = (name: string, members: Members, worn: Grouped, shape: BufferGeometry): void => {
    const held = buckets.get(name)
    // The cell is untouched — the same bodies, whatever their order. A swap-remove reorders a
    // bucket for O(1), so the fast path is element-wise and the set is only built when it fails.
    if (held && held.ids.length === members.ids.length) {
      const moved = sameOrder(held.ids, members.ids)
        ? rewrite(held.mesh, members.meshes.length, slot => members.meshes[slot])
        : sameSet(held.ids, members.ids)
          ? rewriteBy(held, members)
          : null
      if (moved !== null) {
        if (moved) {
          boxes.set(held.mesh, boxOf(members.meshes, shape))
          // The cell's own box is their union: left alone it would be the union of where they
          // STOOD, and a body carried back into view would stay hidden with its cell.
          const cell = members.cell === null ? undefined : cells.get(members.cell)
          if (cell) cell.stale = true
        }
        return
      }
    }
    if (held) drop(name, held)

    const first = members.meshes[0]
    if (!first) return
    const mesh = new InstancedMesh(shape, worn.material, members.meshes.length)
    // It holds world matrices and never moves: three would recompose an identity every frame.
    mesh.matrixAutoUpdate = false
    // Read off the source, which `applyShadowFlags` has already written: the sources sit on a
    // layer the shadow camera never looks at.
    mesh.castShadow = first.castShadow
    mesh.receiveShadow = first.receiveShadow
    for (const [slot, source] of members.meshes.entries()) {
      mesh.setMatrixAt(slot, source.matrixWorld)
      placed.set(members.ids[slot] ?? '', { instance: mesh, slot })
    }
    mesh.instanceMatrix.needsUpdate = true
    // Its own bounds are what the frustum tests: without this a whole cell is culled by the box
    // of a single instance, and it disappears as soon as the camera turns.
    mesh.computeBoundingSphere()
    boxes.set(mesh, boxOf(members.meshes, shape))
    const bucket: Bucket = {
      cell: members.cell,
      ids: members.ids,
      mesh,
      key: worn.key,
      paint: worn.material,
    }
    bucketOf.set(mesh, bucket)
    const into = groupOf(members.cell)
    if (members.cell !== null) {
      const cell = cells.get(members.cell)
      if (cell) owners.set(mesh, cell)
    }
    into.add(mesh)
    buckets.set(name, bucket)
    listStale = true
  }

  /**
   * Measured on 500 000 bodies: this box rejects 155 of the 381 calls three's SPHERE lets through,
   * every one of them drawing no visible instance at all.
   */
  const boxes = new WeakMap<InstancedMesh, Box3>()
  /** The cell each mesh hangs in, so a move can grow ITS box too — see `growBoxes`. */
  const owners = new WeakMap<InstancedMesh, Held>()
  /** Which bucket a mesh draws for, so a body can be taken out of it without rebuilding it. */
  const bucketOf = new WeakMap<InstancedMesh, Bucket>()
  /** One lot per group for the bodies that move, outside every cell — see `Mobile`. */
  const mobiles = new Map<string, Mobile>()
  /** The fallback's own: what moved without ever declaring it would. Sticky — it will move again. */
  const promoted = new Set<string>()

  /**
   * Takes a body out of the lot it sits in WITHOUT rebuilding that lot: the last instance is
   * written over the hole and the count drops by one. A splice would shift every matrix after it,
   * which is the whole cost this exists to avoid.
   */
  const takeOut = (mesh: InstancedMesh, ids: string[], slot: number): void => {
    const last = ids.length - 1
    const swapped = ids[last]
    if (slot !== last && swapped !== undefined) {
      mesh.getMatrixAt(last, AT)
      mesh.setMatrixAt(slot, AT)
      mesh.instanceMatrix.addUpdateRange(slot * 16, 16)
      ids[slot] = swapped
      placed.set(swapped, { instance: mesh, slot })
    }
    ids.pop()
    mesh.count = ids.length
    mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * A lot of `held` slots for one group, replacing the one it outgrew.
   *
   * 🛑 `paint` is the group's own, never `like.material`: a display mode has already replaced the
   * material ON the meshes, and a lot born wearing the stand-in has nothing `paneMemory` can give
   * back — it stays painted through the return to a shaded view.
   */
  const growLot = (
    key: string,
    like: InstancedMesh | Mesh,
    held: Mobile | undefined,
    paint: Material | Material[],
  ): Mobile => {
    const room = Math.max(32, (held?.ids.length ?? 0) * 2)
    const mesh = new InstancedMesh(like.geometry, paint, room)
    mesh.matrixAutoUpdate = false
    // 🛑 A mover goes anywhere: a bounding sphere measured once is wrong at its first step, and
    // three would cull the lot off screen while its bodies are in front of the camera.
    mesh.frustumCulled = false
    mesh.castShadow = like.castShadow
    mesh.receiveShadow = like.receiveShadow
    const ids = held?.ids ?? []
    for (const [slot, id] of ids.entries()) {
      held?.mesh.getMatrixAt(slot, AT)
      mesh.setMatrixAt(slot, AT)
      placed.set(id, { instance: mesh, slot })
    }
    mesh.count = ids.length
    mesh.instanceMatrix.needsUpdate = true
    if (held) {
      held.mesh.removeFromParent()
      held.mesh.dispose()
    }
    host.add(mesh)
    const lot: Mobile = { mesh, ids, paint }
    mobiles.set(key, lot)
    lotOf.set(mesh, lot)
    listStale = true
    built = true
    return lot
  }

  /** Whether a mesh was made outside a rebuild, for the pane that has to dress what was made. */
  let built = false

  /**
   * Moves a body off the grid and onto the lot of movers, once and for all.
   *
   * Its cell stops growing around it — a box that only ever grows would end up covering the level
   * — and no change of content ever rebuilds a static cell for it again.
   */
  const promote = (id: string, objectOf: (id: string) => Object3D | undefined): void => {
    const at = placed.get(id)
    const source = objectOf(id)
    if (!at || !source) return
    const bucket = bucketOf.get(at.instance)
    if (!bucket) return

    takeOut(at.instance, bucket.ids, at.slot)
    promoted.add(id)

    const held = mobiles.get(bucket.key)
    const lot =
      !held || held.ids.length >= held.mesh.instanceMatrix.count
        ? growLot(bucket.key, at.instance, held, held?.paint ?? bucket.paint)
        : held
    pushOnto(lot, id, source.matrixWorld)
    lot.mesh.instanceMatrix.needsUpdate = true
  }

  /** Takes a body onto the end of a lot, at a slot that is now its own. */
  const pushOnto = (lot: Mobile, id: string, placement: Matrix4): void => {
    const slot = lot.ids.length
    lot.ids.push(id)
    lot.mesh.count = lot.ids.length
    lot.mesh.setMatrixAt(slot, placement)
    lot.mesh.instanceMatrix.addUpdateRange(slot * 16, 16)
    placed.set(id, { instance: lot.mesh, slot })
  }

  /** Which lot a mesh IS, so neither a move nor a despawn has to walk them all to find out. */
  const lotOf = new WeakMap<InstancedMesh, Mobile>()

  /** Whether a body is already drawn by a lot of movers rather than by a cell. */
  const onLot = (id: string): boolean => {
    const at = placed.get(id)
    return at !== undefined && lotOf.has(at.instance)
  }

  /**
   * Puts the movers of one group on its lot, keeping the slot of everyone already there — a
   * declared body was never in a cell, so nothing is taken out of one.
   */
  const settleMobile = (
    key: string,
    members: Members,
    like: InstancedMesh | Mesh,
    paint: Material | Material[],
  ): void => {
    if (members.ids.length === 0 && !mobiles.has(key)) return
    let lot = mobiles.get(key)
    for (const [at, id] of members.ids.entries()) {
      const source = members.meshes[at]
      if (!source) continue
      const held = placed.get(id)
      if (lot && held && held.instance === lot.mesh) {
        lot.mesh.setMatrixAt(held.slot, source.matrixWorld)
        lot.mesh.instanceMatrix.addUpdateRange(held.slot * 16, 16)
        continue
      }
      if (!lot || lot.ids.length >= lot.mesh.instanceMatrix.count)
        lot = growLot(key, like, lot, paint)
      pushOnto(lot, id, source.matrixWorld)
    }
    if (lot) lot.mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * What a lot holds and this rebuild did not put there — gone, back on the grid, or moved to
   * another group. Asked PER LOT: a body whose paint changed answers to a different one, and
   * « was it seen at all » left it drawn twice. Walked backwards, since a swap fills the hole
   * from behind.
   */
  const shed = (seen: ReadonlyMap<string, string>): void => {
    for (const [key, lot] of mobiles) {
      for (let slot = lot.ids.length - 1; slot >= 0; slot -= 1) {
        const id = lot.ids[slot]
        if (id === undefined || seen.get(id) === key) continue
        takeOut(lot.mesh, lot.ids, slot)
        promoted.delete(id)
        // Only when nothing else claimed it: a body elsewhere keeps the entry its new home wrote.
        if (placed.get(id)?.instance === lot.mesh) placed.delete(id)
      }
    }
  }

  /**
   * Grows what a moved body is measured by, so a move can only ever show more: its own bucket,
   * and the cell whose box is the union of its buckets'. Leaving the cell out hid the whole of it
   * for the length of a drag — `moved` never marks a cell for remeasuring.
   */
  const growBoxes = (id: string, objectOf: (id: string) => Object3D | undefined): void => {
    const at = placed.get(id)
    if (!at) return
    const box = boxes.get(at.instance)
    const cell = owners.get(at.instance)
    // A mover has neither, and asking for its reach first cost 1.0 ms a frame on 5 015 of them.
    if (!box && !cell) return
    const object = objectOf(id)
    if (!object) return
    const reach = worldReach(at.instance.geometry, object.matrixWorld)
    if (box) grow(box, object.matrixWorld, reach)
    if (cell) grow(cell.box, object.matrixWorld, reach)
  }

  const drawEvery = (): boolean => {
    let moved = false
    for (const [key, held] of cells) {
      if (!held.group.visible) {
        held.group.visible = true
        moved = true
      }
      for (const child of held.group.children) {
        if (child.visible) continue
        child.visible = true
        moved = true
      }
      if (standing.has(key)) continue
      host.add(held.group)
      standing.add(key)
      moved = true
    }
    return moved
  }

  const clear = (): void => {
    for (const [name, bucket] of buckets) drop(name, bucket)
    // The movers with them: they hang from the host and no bucket names them, so a `dispose`
    // that only walked the cells left their instance buffers on the GPU and their meshes in the
    // scene — the one half of the teardown a test that never promoted anything could not see.
    for (const lot of mobiles.values()) {
      for (const id of lot.ids) placed.delete(id)
      lot.mesh.removeFromParent()
      lot.mesh.dispose()
    }
    mobiles.clear()
    promoted.clear()
    listStale = true
  }

  return {
    rebuild: (nodes, objectOf) => {
      const settled = new Set<string>()
      /** Which lot each mover belongs to THIS pass, by group key — see `shed`. */
      const seen = new Map<string, string>()
      let instanced = 0
      for (const worn of sweep(nodes, objectOf, host, ownMaterialOf, keyOf, sources)) {
        const first = worn.meshes[0]
        if (!first) continue
        const movers: Members = { cell: null, ids: [], meshes: [] }
        for (const [name, members] of splitByCell(
          worn,
          index,
          first.geometry,
          seen,
          movers,
          promoted,
        )) {
          settle(name, members, worn, first.geometry)
          settled.add(name)
        }
        settleMobile(worn.key, movers, first, worn.material)
        instanced += worn.meshes.length
      }
      // What nothing settled on holds bodies that left, were hidden, or changed group.
      for (const [name, bucket] of buckets) if (!settled.has(name)) drop(name, bucket)
      // A mover the sweep no longer met is gone from the document — the despawn half of a spawn.
      shed(seen)
      return instanced
    },

    // A body that moves leaves the grid for the lot of movers, and never comes back to it.
    moved: (ids, objectOf) => {
      // Promoted BEFORE the write, so the matrix lands in the lot the body now belongs to.
      for (const id of ids) if (!onLot(id)) promote(id, objectOf)
      const touched = writeMoved(placed, ids, objectOf)
      // Grown, never recut, exactly as the sphere is: a box that shrank under a moving body
      // would hide geometry that is on screen. A mover has neither box nor cell, so this is a
      // no-op for it — which is the point of taking it off the grid.
      if (touched) for (const id of ids) growBoxes(id, objectOf)
      return touched
    },

    // The movers among them: a display mode REPLACES a material, and a lot left out of that walk
    // goes on drawing shaded while everything around it wears the stand-in.
    drawn: () => {
      if (listStale) {
        listed = [...buckets.values()].map(bucket => bucket.mesh)
        for (const lot of mobiles.values()) listed.push(lot.mesh)
        listStale = false
      }
      return listed
    },

    pickable: () => [],

    nodeIdOf: () => null,

    // 🛑 A cell out of the zone LEAVES the scene; it is not merely turned off. `visible` stops
    // `projectObject` and nothing else: `updateMatrixWorld` walks every child whatever the flag
    // says. Measured on 500 000 bodies, 6 912 meshes held: 0.97 ms a frame of pure walking.
    //
    // `null` draws every cell — a film and a capture render from a camera of their own.
    follow: (camera, cast) => {
      const radius = camera ? seenFrom(camera) + index.cellSize / 2 : Infinity
      if (!camera || !Number.isFinite(radius)) return drawEvery()
      // 🛑 The camera's own matrices first, and BOTH of them. A pane is dressed before `render`
      // composes anything, so `matrixWorldInverse` is a frame behind — the cell entering the view
      // is tested against where the eye stood last frame. And a camera of the document hangs
      // under whatever carries it, so `position` is LOCAL: read raw, the disc is centred on the
      // origin and the whole level leaves the scene.
      camera.updateWorldMatrix(true, false)
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
      camera.getWorldPosition(EYE)
      index.query(EYE.x, EYE.z, radius, near)

      wanted.clear()
      for (const key of near) wanted.add(key)
      let moved = false
      for (const key of near) {
        if (standing.has(key)) continue
        const held = cells.get(key)
        if (!held) continue
        host.add(held.group)
        standing.add(key)
        moved = true
      }
      // Over what STANDS rather than over the whole world: the second walk is the size of the
      // zone, not of the document — 53 cells against 257 on the level measured.
      for (const key of standing) {
        if (wanted.has(key)) continue
        cells.get(key)?.group.removeFromParent()
        standing.delete(key)
        moved = true
      }

      // 🛑 Two levels, and the second is the expensive one: the cell first, its lots only if the
      // cell is in the field. Measured on 500 000 bodies, flat over every lot of every standing
      // cell, the test cost 0.42 ms a frame — more than half of what it gives back.
      FRUSTUM.setFromProjectionMatrix(
        VIEW.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      )
      for (const key of standing) {
        const held = cells.get(key)
        if (!held) continue
        if (held.stale) remeasure(held, boxes)
        const inField = FRUSTUM.intersectsBox(sweptBy(held.box, cast))
        if (held.group.visible !== inField) {
          held.group.visible = inField
          moved = true
        }
        if (!inField) continue
        for (const child of held.group.children) {
          const box = child instanceof InstancedMesh ? boxes.get(child) : undefined
          // No box means a bucket whose bodies moved and were never measured again: drawn, and
          // three's own sphere decides. Never the other way — this must only ever hide.
          const draws = box ? FRUSTUM.intersectsBox(sweptBy(box, cast)) : true
          if (child.visible === draws) continue
          child.visible = draws
          moved = true
        }
      }
      return moved
    },

    // Read AND cleared: a pane that has dressed what was made must not redress every frame.
    builtAnew: () => {
      const made = built
      built = false
      return made
    },

    stats: (): GroupingStats => {
      const { nodesVisited, cellsReturned, cells: held, bytes } = index.stats()
      return { nodesVisited, cellsReturned, cellsStanding: standing.size, cells: held, bytes }
    },

    hangSources: sources.hang,

    dropSources: sources.drop,

    refreshSources: sources.refresh,

    holdsSource: sources.holds,

    // The sources back in the walk with it: nothing draws for them any more.
    dispose: () => {
      clear()
      sources.hang()
    },
  }
}

/**
 * What one cell of one group draws, and the nodes it stands for, index for index. `paint` is the
 * group's own material, held because a promotion happens outside a rebuild and has no group left.
 */
type Bucket = {
  cell: CellKey | null
  ids: string[]
  mesh: InstancedMesh
  key: string
  paint: Material | Material[]
}

/**
 * The lot of one group's MOVERS, hung straight from the host.
 *
 * No cell, no zone, no box: a body that moves goes anywhere, and the whole point is that nothing
 * it does ever rebuilds a static cell. Measured in C5-B2 on 5 014 movers of 500 000: 0.901 ms an
 * update against 19.10 in a single structure, and zero mesh rebuilt against 947.
 */
type Mobile = { mesh: InstancedMesh; ids: string[]; paint: Material | Material[] }

/** A cell in the scene: its group, the box its lots together occupy, and whether that box holds. */
type Held = { group: Group; box: Box3; stale: boolean }

/** The union of what its lots occupy, recomposed only when a rebuild touched the cell. */
function remeasure(held: Held, boxes: WeakMap<InstancedMesh, Box3>): void {
  held.box.makeEmpty()
  for (const child of held.group.children) {
    const box = child instanceof InstancedMesh ? boxes.get(child) : undefined
    if (box) held.box.union(box)
    // A lot with no box of its own makes the cell's unbounded: it must never hide anything.
    else held.box.set(NOWHERE.min, NOWHERE.max)
  }
  held.stale = false
}

/** What an unmeasured lot leaves its cell: a box nothing can be outside of. */
const NOWHERE = new Box3(
  new Vector3(-Infinity, -Infinity, -Infinity),
  new Vector3(Infinity, Infinity, Infinity),
)

type Members = { cell: CellKey | null; ids: string[]; meshes: Mesh[] }

/**
 * The bodies of one group, filed under the cell each stands in — and under one loose lot for
 * those too big for any, which are drawn wherever the camera is.
 */
function splitByCell(
  worn: Grouped,
  index: WorldPartition,
  shape: BufferGeometry,
  seen: Map<string, string>,
  movers: Members,
  promoted: ReadonlySet<string>,
): Map<string, Members> {
  const held = new Map<string, Members>()
  for (const [at, mesh] of worn.meshes.entries()) {
    const id = worn.ids[at]
    if (id === undefined) continue
    // 🛑 DECLARED, not deduced: what the document says a body does is read off the node, once per
    // rebuild. Putting a mover back in a cell would rebuild that cell on every change of content.
    if (promoted.has(id) || movesOnItsOwn(worn.nodes[at]?.components)) {
      seen.set(id, worn.key)
      movers.ids.push(id)
      movers.meshes.push(mesh)
      continue
    }
    // The translation read straight off the world matrix, never `decompose`: a non-uniform scale
    // inside a rotated parent shears, and a decomposed translation of a sheared matrix drifts.
    const stands = mesh.matrixWorld.elements
    const spills = !index.fitsACell(worldReach(shape, mesh.matrixWorld))
    const cell = spills ? null : index.cellAt(stands[12] ?? 0, stands[14] ?? 0)
    const name = `${worn.key}|${spills ? 'loose' : cell}`
    const inside = held.get(name)
    if (inside) {
      inside.ids.push(id)
      inside.meshes.push(mesh)
    } else held.set(name, { cell, ids: [id], meshes: [mesh] })
  }
  return held
}

const FRUSTUM = new Frustum()
const VIEW = new Matrix4()
const CORNER = new Vector3()
const EYE = new Vector3()
const AT = new Matrix4()
const SWEPT = new Box3()
const LANDED = new Box3()

/**
 * The box grown by where its own shadow can fall — hiding a caster hides its shadow with it.
 *
 * The union of the box and the box dropped onto the floor along the light: the swept volume is
 * their hull, which that union contains.
 */
function sweptBy(box: Box3, cast: ShadowThrow | null | undefined): Box3 {
  if (!cast || box.isEmpty()) return box
  const drop = box.max.y - cast.floor
  if (drop <= 0) return box
  SWEPT.copy(box)
  for (const along of cast.along) {
    // A light at or above the horizon throws nothing that lands.
    if (along.y >= 0) continue
    const far = drop / -along.y
    LANDED.copy(box).translate(CORNER.set(along.x * far, -drop, along.z * far))
    SWEPT.union(LANDED)
  }
  return SWEPT
}

/** The box the bodies of a bucket occupy, each grown by its own reach. */
function boxOf(meshes: readonly Mesh[], shape: BufferGeometry): Box3 {
  const box = new Box3()
  for (const mesh of meshes) grow(box, mesh.matrixWorld, worldReach(shape, mesh.matrixWorld))
  return box
}

/** Takes in where a body stands, and how far what it draws reaches around that. */
function grow(box: Box3, placement: Matrix4, reach: number): void {
  box.expandByPoint(CORNER.setFromMatrixPosition(placement).addScalar(reach))
  box.expandByPoint(CORNER.setFromMatrixPosition(placement).subScalar(reach))
}

/** Whether it holds the same bodies at all, order aside — the slow half of the check above. */
function sameSet(held: readonly string[], now: readonly string[]): boolean {
  const known = new Set(now)
  for (const id of held) if (!known.has(id)) return false
  return true
}

/**
 * Writes the matrices of a bucket nothing structural changed in, and marks it only if one moved.
 * A node carried under another parent moves without leaving its cell, so the matrices cannot be
 * trusted; comparing costs the read that writing costs anyway, and saves a whole cell's upload.
 */
function rewrite(
  instance: InstancedMesh,
  count: number,
  sourceAt: (slot: number) => Mesh | undefined,
): boolean {
  const held = instance.instanceMatrix.array
  let moved = false
  for (let slot = 0; slot < count; slot += 1) {
    const source = sourceAt(slot)
    if (!source || samePlace(held, slot * 16, source.matrixWorld.elements)) continue
    instance.setMatrixAt(slot, source.matrixWorld)
    moved = true
  }
  if (!moved) return false
  instance.instanceMatrix.needsUpdate = true
  instance.computeBoundingSphere()
  return true
}

/**
 * The same, for a bucket whose bodies were REORDERED — a mover taken out of it by a swap. Each
 * slot keeps the body it held, so nothing has to be rebuilt for a change of order.
 */
function rewriteBy(bucket: Bucket, members: Members): boolean {
  const byId = new Map<string, Mesh>()
  for (const [at, id] of members.ids.entries()) {
    const mesh = members.meshes[at]
    if (mesh) byId.set(id, mesh)
  }
  return rewrite(bucket.mesh, bucket.ids.length, slot => byId.get(bucket.ids[slot] ?? ''))
}

/** `fround` because the buffer holds singles: a double compared raw is never equal to its copy. */
function samePlace(held: ArrayLike<number>, base: number, stands: readonly number[]): boolean {
  for (let at = 0; at < 16; at += 1) {
    if (held[base + at] !== Math.fround(stands[at] ?? 0)) return false
  }
  return true
}

/**
 * How far a camera can see, as a disc around where it stands: the far CORNER of its volume, never
 * `far` alone — a top view of a level is wider than it is deep, and the disc would cut its sides.
 */
function seenFrom(camera: Camera): number {
  if (camera instanceof PerspectiveCamera) {
    const high = camera.far * Math.tan(toRadians(camera.fov / 2))
    return Math.hypot(camera.far, high, high * camera.aspect)
  }
  if (camera instanceof OrthographicCamera) {
    return Math.hypot(
      camera.far,
      (camera.right - camera.left) / (2 * camera.zoom),
      (camera.top - camera.bottom) / (2 * camera.zoom),
    )
  }
  return Infinity
}
