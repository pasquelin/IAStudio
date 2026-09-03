/**
 * The relief a scene draws: one BufferGeometry per chunk, so a sculpt stroke re-uploads only
 * the chunks it dirtied — `addUpdateRange` on position and normal, never computeVertexNormals.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Scene,
} from 'three'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import { clamp } from '@shared/numeric'
import {
  changedChunks,
  chunkCountAlong,
  chunkLayout,
  reliefReader,
  worldY,
  type PackedReliefChunk,
  type ReliefChunkKey,
  type ReliefChunkLayout,
  type ReliefExtent,
  type ReliefRead,
  type ReliefSculpt,
} from '@shared/domain/relief'
import { enabledTerrains } from '@shared/domain/scene'
import type { ReliefLayer, SceneWorld, TerrainEditLayer } from '@shared/domain/scene'
import { loadHeightmap } from './heightmap'
import type { ReliefBuilder } from './reliefBuilder'
import type { ReliefGeometryData } from './reliefBuildMessage'

export type ReliefSurface = {
  object: Object3D
  sync: (world: SceneWorld, samples?: HeightmapSamples) => void
  meshOf: (terrainId: string, column: number, row: number) => Mesh | undefined
  sculptSource: (terrainId: string, editId: string) => ReliefSculptSource | null
  dispose: () => void
}

export type ReliefSculptSource = {
  samples: HeightmapSamples
  extent: ReliefExtent
  grain: number
  sculpt: ReliefSculpt | undefined
}

export type ReliefSurfaceOptions = {
  load?: (assetId: string) => Promise<HeightmapSamples>
  builder?: ReliefBuilder
  onReady?: () => void
  onFailure?: (assetId: string, error: unknown) => void
}

const RELIEF_NAME = 'scene-relief'

type Held = {
  assetId: string
  samples: HeightmapSamples
  extent: ReliefExtent
  grain: number
  edits: readonly TerrainEditLayer[]
}

type SampleRect = { minX: number; maxX: number; minZ: number; maxZ: number }

type TerrainSurface = {
  group: Group
  meshes: Map<string, Mesh>
  held: Held | null
  /** The heightmap a load is under way for, so a second sync does not start it over. */
  loading: string | null
  /** The last layer asked for, which a load that started before it must still honour. */
  wanted: ReliefLayer | null
  generation: number
  buildAbort: AbortController | null
}

type SurfaceState = {
  group: Group
  material: MeshStandardMaterial
  terrains: Map<string, TerrainSurface>
  options: ReliefSurfaceOptions
  load: (assetId: string) => Promise<HeightmapSamples>
  builder: ReliefBuilder | undefined
}

export function createReliefSurface(
  scene: Scene,
  options: ReliefSurfaceOptions = {},
): ReliefSurface {
  const state: SurfaceState = {
    group: new Group(),
    material: new MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    terrains: new Map(),
    options,
    load: options.load ?? (assetId => loadHeightmap(assetId)),
    builder: options.builder,
  }
  state.group.name = RELIEF_NAME
  scene.add(state.group)
  return {
    object: state.group,
    sync: (world, samples) => syncRelief(state, world, samples),
    meshOf: (terrainId, column, row) =>
      state.terrains.get(terrainId)?.meshes.get(keyOf(column, row)),
    sculptSource: (terrainId, editId) => {
      const held = state.terrains.get(terrainId)?.held
      const edit = held?.edits.find(candidate => candidate.id === editId)
      return held && edit
        ? { samples: held.samples, extent: held.extent, grain: held.grain, sculpt: edit.sculpt }
        : null
    },
    dispose: () => disposeRelief(state),
  }
}

function syncRelief(state: SurfaceState, world: SceneWorld, samples?: HeightmapSamples): void {
  const wanted = enabledTerrains(world.layers)
  const ids = new Set(wanted.map(layer => layer.id))
  for (const [id, terrain] of [...state.terrains]) {
    if (!ids.has(id)) dropTerrain(state, id, terrain)
  }
  for (const layer of wanted) {
    const terrain = terrainSurfaceOf(state, layer)
    terrain.wanted = layer
    if (samples) {
      applyLayer(state, terrain, layer, samples)
      continue
    }
    if (terrain.held?.assetId === layer.heightmap.assetId) {
      applyLayer(state, terrain, layer, terrain.held.samples)
      continue
    }
    // Restarting a load in flight bumped the generation, so the answer about to land was thrown
    // away and a large heightmap was read again from the top on every world change.
    if (terrain.loading === layer.heightmap.assetId) continue
    void loadLayer(state, terrain, layer)
  }
}

function terrainSurfaceOf(state: SurfaceState, layer: ReliefLayer): TerrainSurface {
  const held = state.terrains.get(layer.id)
  if (held) return held
  const terrain: TerrainSurface = {
    group: new Group(),
    meshes: new Map(),
    held: null,
    loading: null,
    wanted: null,
    generation: 0,
    buildAbort: null,
  }
  terrain.group.name = `relief-${layer.id}`
  state.terrains.set(layer.id, terrain)
  return terrain
}

function dropTerrain(state: SurfaceState, id: string, terrain: TerrainSurface): void {
  terrain.generation += 1
  terrain.buildAbort?.abort()
  clearMeshes(terrain.meshes)
  terrain.group.removeFromParent()
  state.terrains.delete(id)
}

function applyLayer(
  state: SurfaceState,
  terrain: TerrainSurface,
  layer: ReliefLayer,
  samples: HeightmapSamples,
): boolean {
  const extent: ReliefExtent = {
    origin: layer.origin,
    size: layer.size,
    elevation: layer.elevation,
  }
  if (needsRebuild(terrain.held, samples, layer.grain, extent, layer.edits)) {
    if (state.builder) {
      void buildMeshesAway(state, terrain, state.builder, layer, samples, extent)
      return false
    }
    dropPendingBuild(terrain)
    clearMeshes(terrain.meshes)
    buildMeshes(state, terrain, samples, extent, layer.grain, layer.edits)
  } else {
    dropPendingBuild(terrain)
    patchMeshes(terrain, samples, extent, layer.grain, terrain.held?.edits ?? [], layer.edits)
  }
  terrain.held = {
    assetId: layer.heightmap.assetId,
    samples,
    extent,
    grain: layer.grain,
    edits: layer.edits,
  }
  return true
}

/**
 * A build in flight was computed for edits this call has just replaced — an alpha moved and moved
 * back is enough. Left alone it landed with a token still current and painted the older surface
 * over the one being drawn.
 */
function dropPendingBuild(terrain: TerrainSurface): void {
  if (!terrain.buildAbort) return
  terrain.generation += 1
  terrain.buildAbort.abort()
  terrain.buildAbort = null
}

async function buildMeshesAway(
  state: SurfaceState,
  terrain: TerrainSurface,
  builder: ReliefBuilder,
  layer: ReliefLayer,
  samples: HeightmapSamples,
  extent: ReliefExtent,
): Promise<void> {
  terrain.buildAbort?.abort()
  const abort = new AbortController()
  terrain.buildAbort = abort
  const token = ++terrain.generation
  try {
    const chunks = await builder.build(samples, extent, layer.grain, layer.edits, abort.signal)
    if (!chunks || token !== terrain.generation) return
    clearMeshes(terrain.meshes)
    buildMeshesFromData(state, terrain, chunks)
    terrain.held = {
      assetId: layer.heightmap.assetId,
      samples,
      extent,
      grain: layer.grain,
      edits: layer.edits,
    }
    state.options.onReady?.()
  } catch (error) {
    if (token === terrain.generation) state.options.onFailure?.(layer.heightmap.assetId, error)
  } finally {
    if (terrain.buildAbort === abort) terrain.buildAbort = null
  }
}

function needsRebuild(
  held: Held | null,
  samples: HeightmapSamples,
  grain: number,
  extent: ReliefExtent,
  edits: readonly TerrainEditLayer[],
): boolean {
  if (!held || held.samples !== samples || held.grain !== grain) return true
  if (blendChanged(held.edits, edits)) return true
  return (
    held.extent.origin.x !== extent.origin.x ||
    held.extent.origin.z !== extent.origin.z ||
    held.extent.size.x !== extent.size.x ||
    held.extent.size.z !== extent.size.z ||
    held.extent.elevation.min !== extent.elevation.min ||
    held.extent.elevation.max !== extent.elevation.max
  )
}

function blendChanged(
  before: readonly TerrainEditLayer[],
  after: readonly TerrainEditLayer[],
): boolean {
  const previous = new Map(before.map(edit => [edit.id, edit]))
  for (const edit of after) {
    const held = previous.get(edit.id)
    if (held && (held.enabled !== edit.enabled || held.alpha !== edit.alpha)) return true
  }
  return false
}

async function loadLayer(
  state: SurfaceState,
  terrain: TerrainSurface,
  layer: ReliefLayer,
): Promise<void> {
  const token = ++terrain.generation
  terrain.loading = layer.heightmap.assetId
  try {
    const samples = await state.load(layer.heightmap.assetId)
    if (token !== terrain.generation) return
    const asked =
      terrain.wanted?.heightmap.assetId === layer.heightmap.assetId ? terrain.wanted : layer
    if (applyLayer(state, terrain, asked, samples)) state.options.onReady?.()
  } catch (error) {
    if (token !== terrain.generation) return
    dropTerrain(state, layer.id, terrain)
    state.options.onFailure?.(layer.heightmap.assetId, error)
  } finally {
    if (token === terrain.generation) terrain.loading = null
  }
}

function disposeRelief(state: SurfaceState): void {
  for (const [id, terrain] of [...state.terrains]) dropTerrain(state, id, terrain)
  state.builder?.dispose()
  state.material.dispose()
  state.group.removeFromParent()
}

function buildMeshes(
  state: SurfaceState,
  terrain: TerrainSurface,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  grain: number,
  edits: readonly TerrainEditLayer[],
): void {
  const columns = chunkCountAlong(samples.width, grain)
  const rows = chunkCountAlong(samples.height, grain)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const layout = chunkLayout(column, row, samples.width, samples.height, grain)
      addMesh(state, terrain, reliefGeometryData(samples, extent, layout, grain, edits))
    }
  }
  if (terrain.group.parent !== state.group) state.group.add(terrain.group)
}

function buildMeshesFromData(
  state: SurfaceState,
  terrain: TerrainSurface,
  chunks: readonly ReliefGeometryData[],
): void {
  for (const chunk of chunks) addMesh(state, terrain, chunk)
  if (terrain.group.parent !== state.group) state.group.add(terrain.group)
}

function addMesh(state: SurfaceState, terrain: TerrainSurface, data: ReliefGeometryData): void {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(data.position, 3).setUsage(DynamicDrawUsage),
  )
  geometry.setAttribute('normal', new BufferAttribute(data.normal, 3).setUsage(DynamicDrawUsage))
  geometry.setAttribute('uv', new BufferAttribute(data.uv, 2))
  geometry.setIndex(new BufferAttribute(data.index, 1))
  const mesh = new Mesh(geometry, state.material)
  mesh.name = `relief-chunk-${data.column}-${data.row}`
  mesh.castShadow = false
  mesh.receiveShadow = true
  terrain.group.add(mesh)
  terrain.meshes.set(keyOf(data.column, data.row), mesh)
}

function patchMeshes(
  terrain: TerrainSurface,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  grain: number,
  before: readonly TerrainEditLayer[],
  after: readonly TerrainEditLayer[],
): void {
  for (const mesh of terrain.meshes.values()) clearChunkRanges(mesh)
  const edits = dirtiedChunks(before, after)
  const beforeRead = reliefReader(samples, grain, before)
  const afterRead = reliefReader(samples, grain, after)
  const dirty = new Map<string, { layout: ReliefChunkLayout; rect: SampleRect }>()

  for (const { column, row } of edits) {
    const mesh = terrain.meshes.get(keyOf(column, row))
    if (!mesh) continue
    const layout = chunkLayout(column, row, samples.width, samples.height, grain)
    const rect = changedRect(layout, beforeRead, afterRead)
    if (!rect) continue
    dirty.set(keyOf(column, row), { layout, rect })
    writeChunkRegion(mesh.geometry, samples, extent, layout, afterRead, rect)
  }

  // 🛑 A normal reads the 1-ring around its vertex, and that ring CROSSES the chunk border: the
  // neighbour's own edge column is lit by heights this stroke just moved. Left alone it kept the
  // lighting of before — a crease down every seam a brush came near, and one that never healed.
  // Its normals only: nothing moved on that side, so its positions are already true.
  for (const key of borderingChunks(dirty, samples, grain)) {
    const mesh = terrain.meshes.get(keyOf(key.column, key.row))
    if (!mesh) continue
    const layout = chunkLayout(key.column, key.row, samples.width, samples.height, grain)
    writeChunkNormals(mesh.geometry, samples, extent, layout, grain, after)
  }
}

/** The chunks touching a dirtied one, the dirtied ones themselves left out. */
function borderingChunks(
  dirty: ReadonlyMap<string, { layout: ReliefChunkLayout; rect: SampleRect }>,
  samples: HeightmapSamples,
  grain: number,
): ReliefChunkKey[] {
  const columns = chunkCountAlong(samples.width, grain)
  const rows = chunkCountAlong(samples.height, grain)
  const around = new Map<string, ReliefChunkKey>()

  for (const [key, { layout, rect }] of dirty) {
    const [column, row] = key.split(':').map(Number)
    if (column === undefined || row === undefined) continue

    const candidates = [
      ...(rect.minX <= 1 ? [{ column: column - 1, row }] : []),
      ...(rect.maxX >= layout.width - 2 ? [{ column: column + 1, row }] : []),
      ...(rect.minZ <= 1 ? [{ column, row: row - 1 }] : []),
      ...(rect.maxZ >= layout.height - 2 ? [{ column, row: row + 1 }] : []),
    ]
    for (const near of candidates) {
      const outside = near.column < 0 || near.column >= columns || near.row < 0 || near.row >= rows
      if (outside || dirty.has(keyOf(near.column, near.row))) continue
      around.set(keyOf(near.column, near.row), near)
    }
  }
  return [...around.values()]
}

function changedRect(
  layout: ReliefChunkLayout,
  before: ReliefRead,
  after: ReliefRead,
): SampleRect | null {
  let rect: SampleRect | null = null
  for (let z = 0; z < layout.height; z++) {
    for (let x = 0; x < layout.width; x++) {
      const sampleX = layout.sampleX + x
      const sampleZ = layout.sampleZ + z
      if (before(sampleX, sampleZ) === after(sampleX, sampleZ)) continue
      if (!rect) rect = { minX: x, maxX: x, minZ: z, maxZ: z }
      else {
        rect.minX = Math.min(rect.minX, x)
        rect.maxX = Math.max(rect.maxX, x)
        rect.minZ = Math.min(rect.minZ, z)
        rect.maxZ = Math.max(rect.maxZ, z)
      }
    }
  }
  return rect
}

function dirtiedChunks(
  before: readonly TerrainEditLayer[],
  after: readonly TerrainEditLayer[],
): PackedReliefChunk[] {
  const keys = new Map<string, PackedReliefChunk>()
  const previous = new Map(before.map(edit => [edit.id, edit]))
  const next = new Map(after.map(edit => [edit.id, edit]))
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const left = previous.get(id)?.sculpt
    const right = next.get(id)?.sculpt ?? { chunks: [] }
    for (const chunk of changedChunks(left, right)) {
      keys.set(`${chunk.column}:${chunk.row}`, chunk)
    }
  }
  return [...keys.values()]
}

function clearChunkRanges(mesh: Mesh): void {
  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  if (position instanceof BufferAttribute) position.clearUpdateRanges()
  if (normal instanceof BufferAttribute) normal.clearUpdateRanges()
}

function keyOf(column: number, row: number): string {
  return `${column}:${row}`
}

function clearMeshes(meshes: Map<string, Mesh>): void {
  for (const mesh of meshes.values()) {
    mesh.geometry.dispose()
    mesh.removeFromParent()
  }
  meshes.clear()
}

export function reliefGeometryData(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  grain: number,
  edits: readonly TerrainEditLayer[],
): ReliefGeometryData {
  const vertices = layout.width * layout.height
  const position = new Float32Array(vertices * 3)
  const normal = new Float32Array(vertices * 3)
  const uv = new Float32Array(vertices * 2)
  const read = reliefReader(samples, grain, edits)
  writePositions(position, samples, extent, layout, read)
  writeNormals(normal, samples, extent, layout, read)
  writeUv(uv, layout, samples)
  return { column: layout.column, row: layout.row, position, normal, uv, index: chunkIndex(layout) }
}

function writeChunkRegion(
  geometry: BufferGeometry,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  read: ReliefRead,
  rect: SampleRect,
): void {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!(position instanceof BufferAttribute) || !(normal instanceof BufferAttribute)) return
  if (!(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array)) return
  writeHeights(position.array, extent, layout, read, rect)
  const normalRect = expandRect(rect, layout, 1)
  writeNormalRegion(normal.array, samples, extent, layout, read, normalRect)
  markRegion(position, layout.width, rect)
  markRegion(normal, layout.width, normalRect)
  position.needsUpdate = true
  normal.needsUpdate = true
}

function expandRect(rect: SampleRect, layout: ReliefChunkLayout, amount: number): SampleRect {
  return {
    minX: Math.max(0, rect.minX - amount),
    maxX: Math.min(layout.width - 1, rect.maxX + amount),
    minZ: Math.max(0, rect.minZ - amount),
    maxZ: Math.min(layout.height - 1, rect.maxZ + amount),
  }
}

function markRegion(attribute: BufferAttribute, width: number, rect: SampleRect): void {
  const count = (rect.maxX - rect.minX + 1) * 3
  for (let z = rect.minZ; z <= rect.maxZ; z++) {
    attribute.addUpdateRange((z * width + rect.minX) * 3, count)
  }
}

function writeHeights(
  into: Float32Array,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  read: ReliefRead,
  rect: SampleRect,
): void {
  for (let z = rect.minZ; z <= rect.maxZ; z++) {
    for (let x = rect.minX; x <= rect.maxX; x++) {
      const at = (z * layout.width + x) * 3 + 1
      into[at] = worldY(read(layout.sampleX + x, layout.sampleZ + z), extent.elevation)
    }
  }
}

function writeNormalRegion(
  into: Float32Array,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  read: ReliefRead,
  rect: SampleRect,
): void {
  const stepX = extent.size.x / Math.max(1, samples.width - 1)
  const stepZ = extent.size.z / Math.max(1, samples.height - 1)
  for (let z = rect.minZ; z <= rect.maxZ; z++) {
    for (let x = rect.minX; x <= rect.maxX; x++) {
      const sampleX = layout.sampleX + x
      const sampleZ = layout.sampleZ + z
      const nx =
        (heightAt(samples, read, extent, sampleX - 1, sampleZ) -
          heightAt(samples, read, extent, sampleX + 1, sampleZ)) /
        (2 * stepX)
      const nz =
        (heightAt(samples, read, extent, sampleX, sampleZ - 1) -
          heightAt(samples, read, extent, sampleX, sampleZ + 1)) /
        (2 * stepZ)
      const length = Math.hypot(nx, 1, nz) || 1
      const at = (z * layout.width + x) * 3
      into[at] = nx / length
      into[at + 1] = 1 / length
      into[at + 2] = nz / length
    }
  }
}

/** Rewrites a neighbour's lighting, never its shape. */
function writeChunkNormals(
  geometry: BufferGeometry,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  grain: number,
  edits: readonly TerrainEditLayer[],
): void {
  const normal = geometry.getAttribute('normal')
  if (!(normal instanceof BufferAttribute) || !(normal.array instanceof Float32Array)) return

  writeNormals(normal.array, samples, extent, layout, reliefReader(samples, grain, edits))
  markChunk(normal)
  normal.needsUpdate = true
}

function markChunk(attribute: BufferAttribute): void {
  attribute.addUpdateRange(0, attribute.count * attribute.itemSize)
}

function writePositions(
  into: Float32Array,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  read: ReliefRead,
): void {
  const stepX = extent.size.x / Math.max(1, samples.width - 1)
  const stepZ = extent.size.z / Math.max(1, samples.height - 1)
  let cursor = 0
  for (let lz = 0; lz < layout.height; lz++) {
    for (let lx = 0; lx < layout.width; lx++) {
      const sx = layout.sampleX + lx
      const sz = layout.sampleZ + lz
      into[cursor] = extent.origin.x + sx * stepX
      into[cursor + 1] = worldY(read(sx, sz), extent.elevation)
      into[cursor + 2] = extent.origin.z + sz * stepZ
      cursor += 3
    }
  }
}

function writeNormals(
  into: Float32Array,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  read: ReliefRead,
): void {
  writeNormalRegion(into, samples, extent, layout, read, {
    minX: 0,
    maxX: layout.width - 1,
    minZ: 0,
    maxZ: layout.height - 1,
  })
}

function heightAt(
  samples: HeightmapSamples,
  read: ReliefRead,
  extent: ReliefExtent,
  sx: number,
  sz: number,
): number {
  const x = clamp(sx, 0, samples.width - 1)
  const z = clamp(sz, 0, samples.height - 1)
  return worldY(read(x, z), extent.elevation)
}

function writeUv(into: Float32Array, layout: ReliefChunkLayout, samples: HeightmapSamples): void {
  const spanX = Math.max(1, samples.width - 1)
  const spanZ = Math.max(1, samples.height - 1)
  let cursor = 0
  for (let lz = 0; lz < layout.height; lz++) {
    for (let lx = 0; lx < layout.width; lx++) {
      into[cursor] = (layout.sampleX + lx) / spanX
      into[cursor + 1] = (layout.sampleZ + lz) / spanZ
      cursor += 2
    }
  }
}

function chunkIndex(layout: ReliefChunkLayout): Uint16Array {
  const quadsX = Math.max(0, layout.width - 1)
  const quadsZ = Math.max(0, layout.height - 1)
  const indices = new Uint16Array(quadsX * quadsZ * 6)
  let cursor = 0
  for (let z = 0; z < quadsZ; z++) {
    for (let x = 0; x < quadsX; x++) {
      const i = z * layout.width + x
      indices[cursor] = i
      indices[cursor + 1] = i + 1
      indices[cursor + 2] = i + layout.width
      indices[cursor + 3] = i + 1
      indices[cursor + 4] = i + layout.width + 1
      indices[cursor + 5] = i + layout.width
      cursor += 6
    }
  }
  return indices
}
