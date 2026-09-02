import {
  Group,
  InstancedMesh,
  OrthographicCamera,
  PerspectiveCamera,
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
  writeMoved,
  type Grouped,
  type InstancedGroups,
  type Placed,
} from './grouping'
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
  const cells = new Map<CellKey, Group>()
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
    if (known) return known
    const group = new Group()
    group.matrixAutoUpdate = false
    host.add(group)
    cells.set(cell, group)
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
    const group = cells.get(bucket.cell)
    if (!group || group.children.length > 0) return
    group.removeFromParent()
    cells.delete(bucket.cell)
    standing.delete(bucket.cell)
    index.release(bucket.cell)
  }

  const settle = (name: string, members: Members, worn: Grouped, shape: BufferGeometry): void => {
    const held = buckets.get(name)
    // The cell is untouched: its bodies are the same ones in the same order, so the mesh it was
    // drawn by is reused and only the matrices that really moved reach the GPU.
    if (held && sameOrder(held.ids, members.ids)) {
      rewrite(held.mesh, members.meshes)
      return
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
    groupOf(members.cell).add(mesh)
    buckets.set(name, { cell: members.cell, ids: members.ids, mesh })
    listStale = true
  }

  const drawEvery = (): boolean => {
    let moved = false
    for (const [key, group] of cells) {
      if (standing.has(key)) continue
      host.add(group)
      standing.add(key)
      moved = true
    }
    return moved
  }

  const clear = (): void => {
    for (const [name, bucket] of buckets) drop(name, bucket)
  }

  return {
    rebuild: (nodes, objectOf) => {
      const settled = new Set<string>()
      let instanced = 0
      for (const worn of sweep(nodes, objectOf, host, ownMaterialOf, keyOf, sources)) {
        const first = worn.meshes[0]
        if (!first) continue
        for (const [name, members] of splitByCell(worn, index, first.geometry)) {
          settle(name, members, worn, first.geometry)
          settled.add(name)
        }
        instanced += worn.meshes.length
      }
      // What nothing settled on holds bodies that left, were hidden, or changed group.
      for (const [name, bucket] of buckets) if (!settled.has(name)) drop(name, bucket)
      return instanced
    },

    // The body keeps the cell it was built in until the next change of content: a gesture that
    // crossed a border would otherwise rebuild two cells per pointer move. What it costs is a
    // cell drawn a little further than it reaches.
    moved: (ids, objectOf) => writeMoved(placed, ids, objectOf),

    drawn: () => {
      if (listStale) {
        listed = [...buckets.values()].map(bucket => bucket.mesh)
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
    follow: camera => {
      const radius = camera ? seenFrom(camera) + index.cellSize / 2 : Infinity
      if (!camera || !Number.isFinite(radius)) return drawEvery()
      index.query(camera.position.x, camera.position.z, radius, near)

      wanted.clear()
      for (const key of near) wanted.add(key)
      let moved = false
      for (const key of near) {
        const group = standing.has(key) ? null : cells.get(key)
        if (!group) continue
        host.add(group)
        standing.add(key)
        moved = true
      }
      // Over what STANDS rather than over the whole world: the second walk is the size of the
      // zone, not of the document — 53 cells against 257 on the level measured.
      for (const key of standing) {
        if (wanted.has(key)) continue
        cells.get(key)?.removeFromParent()
        standing.delete(key)
        moved = true
      }
      return moved
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

/** What one cell of one group draws, and the nodes it stands for, index for index. */
type Bucket = { cell: CellKey | null; ids: string[]; mesh: InstancedMesh }

type Members = { cell: CellKey | null; ids: string[]; meshes: Mesh[] }

/**
 * The bodies of one group, filed under the cell each stands in — and under one loose lot for
 * those too big for any, which are drawn wherever the camera is.
 */
function splitByCell(
  worn: Grouped,
  index: WorldPartition,
  shape: BufferGeometry,
): Map<string, Members> {
  const held = new Map<string, Members>()
  const reach = reachOf(shape)
  for (const [at, mesh] of worn.meshes.entries()) {
    const id = worn.ids[at]
    if (id === undefined) continue
    // The translation read straight off the world matrix, never `decompose`: a non-uniform scale
    // inside a rotated parent shears, and a decomposed translation of a sheared matrix drifts.
    const stands = mesh.matrixWorld.elements
    const spills = !index.fitsACell(reach * mesh.matrixWorld.getMaxScaleOnAxis())
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

/** Whether a cell holds the same bodies it held, in the same slots. */
function sameOrder(held: readonly string[], now: readonly string[]): boolean {
  if (held.length !== now.length) return false
  for (const [at, id] of now.entries()) if (held[at] !== id) return false
  return true
}

/**
 * Writes the matrices of a cell nothing structural changed in, and marks it only if one moved.
 *
 * A rebuild runs on every change of CONTENT, and a node carried under another parent moves
 * without leaving its cell — so the matrices cannot simply be trusted. Comparing them costs the
 * read that writing them costs anyway, and what it saves is the upload of a whole cell.
 */
function rewrite(instance: InstancedMesh, meshes: readonly Mesh[]): void {
  const held = instance.instanceMatrix.array
  let moved = false
  for (const [slot, source] of meshes.entries()) {
    if (samePlace(held, slot * 16, source.matrixWorld.elements)) continue
    instance.setMatrixAt(slot, source.matrixWorld)
    moved = true
  }
  if (!moved) return
  instance.instanceMatrix.needsUpdate = true
  instance.computeBoundingSphere()
}

/** `fround` because the buffer holds singles: a double compared raw is never equal to its copy. */
function samePlace(held: ArrayLike<number>, base: number, stands: readonly number[]): boolean {
  for (let at = 0; at < 16; at += 1) {
    if (held[base + at] !== Math.fround(stands[at] ?? 0)) return false
  }
  return true
}

function reachOf(geometry: BufferGeometry): number {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  return geometry.boundingSphere?.radius ?? 0
}

/**
 * How far a camera can see, as a disc around where it stands: the far CORNER of its volume, never
 * `far` alone — a top view of a level is wider than it is deep, and the disc would cut its sides.
 */
function seenFrom(camera: Camera): number {
  if (camera instanceof PerspectiveCamera) {
    const high = camera.far * Math.tan((camera.fov * Math.PI) / 360)
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
