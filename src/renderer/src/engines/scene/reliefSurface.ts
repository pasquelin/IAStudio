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

type TerrainSurface = {
  group: Group
  meshes: Map<string, Mesh>
  held: Held | null
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
  const wanted = world.layers.filter(
    (layer): layer is ReliefLayer => layer.kind === 'relief' && layer.enabled,
  )
  const ids = new Set(wanted.map(layer => layer.id))
  for (const [id, terrain] of [...state.terrains]) {
    if (!ids.has(id)) dropTerrain(state, id, terrain)
  }
  for (const layer of wanted) {
    const terrain = terrainSurfaceOf(state, layer)
    if (samples) {
      applyLayer(state, terrain, layer, samples)
      continue
    }
    if (terrain.held?.assetId === layer.heightmap.assetId) {
      applyLayer(state, terrain, layer, terrain.held.samples)
      continue
    }
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
    clearMeshes(terrain.meshes)
    buildMeshes(state, terrain, samples, extent, layer.grain, layer.edits)
  } else {
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
  try {
    const samples = await state.load(layer.heightmap.assetId)
    if (token !== terrain.generation) return
    if (applyLayer(state, terrain, layer, samples)) state.options.onReady?.()
  } catch (error) {
    if (token !== terrain.generation) return
    dropTerrain(state, layer.id, terrain)
    state.options.onFailure?.(layer.heightmap.assetId, error)
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
  const dirty = new Set(edits.map(edit => keyOf(edit.column, edit.row)))

  for (const { column, row } of edits) {
    const mesh = terrain.meshes.get(keyOf(column, row))
    if (!mesh) continue
    const layout = chunkLayout(column, row, samples.width, samples.height, grain)
    writeChunk(mesh.geometry, samples, extent, layout, grain, after, true)
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
  dirty: ReadonlySet<string>,
  samples: HeightmapSamples,
  grain: number,
): ReliefChunkKey[] {
  const columns = chunkCountAlong(samples.width, grain)
  const rows = chunkCountAlong(samples.height, grain)
  const around = new Map<string, ReliefChunkKey>()

  for (const key of dirty) {
    const [column, row] = key.split(':').map(Number)
    if (column === undefined || row === undefined) continue

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const near = { column: column + dx, row: row + dz }
        const outside =
          near.column < 0 || near.column >= columns || near.row < 0 || near.row >= rows
        if (outside || dirty.has(keyOf(near.column, near.row))) continue
        around.set(keyOf(near.column, near.row), near)
      }
    }
  }
  return [...around.values()]
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

function writeChunk(
  geometry: BufferGeometry,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  grain: number,
  edits: readonly TerrainEditLayer[],
  ranged: boolean,
): void {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!(position instanceof BufferAttribute) || !(normal instanceof BufferAttribute)) return
  if (!(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array)) return
  const read = reliefReader(samples, grain, edits)
  writePositions(position.array, samples, extent, layout, read)
  writeNormals(normal.array, samples, extent, layout, read)
  if (ranged) {
    markChunk(position)
    markChunk(normal)
  }
  position.needsUpdate = true
  normal.needsUpdate = true
}

/** What `writeChunk` does for a neighbour: its lighting, never its shape. */
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
  const stepX = extent.size.x / Math.max(1, samples.width - 1)
  const stepZ = extent.size.z / Math.max(1, samples.height - 1)
  let cursor = 0
  for (let lz = 0; lz < layout.height; lz++) {
    for (let lx = 0; lx < layout.width; lx++) {
      const sx = layout.sampleX + lx
      const sz = layout.sampleZ + lz
      const nx =
        (heightAt(samples, read, extent, sx - 1, sz) -
          heightAt(samples, read, extent, sx + 1, sz)) /
        (2 * stepX)
      const nz =
        (heightAt(samples, read, extent, sx, sz - 1) -
          heightAt(samples, read, extent, sx, sz + 1)) /
        (2 * stepZ)
      const length = Math.hypot(nx, 1, nz) || 1
      into[cursor] = nx / length
      into[cursor + 1] = 1 / length
      into[cursor + 2] = nz / length
      cursor += 3
    }
  }
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
