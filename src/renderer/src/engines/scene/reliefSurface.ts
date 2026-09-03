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
} from '@shared/domain/relief'
import type { ReliefLayer, SceneWorld, TerrainEditLayer } from '@shared/domain/scene'
import { loadHeightmap } from './heightmap'

export type ReliefSurface = {
  object: Object3D
  sync: (world: SceneWorld, samples?: HeightmapSamples) => void
  meshOf: (terrainId: string, column: number, row: number) => Mesh | undefined
  dispose: () => void
}

export type ReliefSurfaceOptions = {
  load?: (assetId: string) => Promise<HeightmapSamples>
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
}

type SurfaceState = {
  group: Group
  material: MeshStandardMaterial
  terrains: Map<string, TerrainSurface>
  options: ReliefSurfaceOptions
  load: (assetId: string) => Promise<HeightmapSamples>
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
  }
  state.group.name = RELIEF_NAME
  scene.add(state.group)
  return {
    object: state.group,
    sync: (world, samples) => syncRelief(state, world, samples),
    meshOf: (terrainId, column, row) =>
      state.terrains.get(terrainId)?.meshes.get(keyOf(column, row)),
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
  }
  terrain.group.name = `relief-${layer.id}`
  state.group.add(terrain.group)
  state.terrains.set(layer.id, terrain)
  return terrain
}

function dropTerrain(state: SurfaceState, id: string, terrain: TerrainSurface): void {
  terrain.generation += 1
  clearMeshes(terrain.meshes)
  terrain.group.removeFromParent()
  state.terrains.delete(id)
}

function applyLayer(
  state: SurfaceState,
  terrain: TerrainSurface,
  layer: ReliefLayer,
  samples: HeightmapSamples,
): void {
  const extent: ReliefExtent = {
    origin: layer.origin,
    size: layer.size,
    elevation: layer.elevation,
  }
  if (needsRebuild(terrain.held, samples, layer.grain, extent, layer.edits)) {
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
    applyLayer(state, terrain, layer, samples)
    state.options.onReady?.()
  } catch (error) {
    if (token !== terrain.generation) return
    state.options.onFailure?.(layer.heightmap.assetId, error)
  }
}

function disposeRelief(state: SurfaceState): void {
  for (const [id, terrain] of [...state.terrains]) dropTerrain(state, id, terrain)
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
      const mesh = new Mesh(chunkGeometry(samples, extent, layout, grain, edits), state.material)
      mesh.name = `relief-chunk-${column}-${row}`
      mesh.castShadow = false
      mesh.receiveShadow = true
      terrain.group.add(mesh)
      terrain.meshes.set(keyOf(column, row), mesh)
    }
  }
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

function chunkGeometry(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  grain: number,
  edits: readonly TerrainEditLayer[],
): BufferGeometry {
  const vertices = layout.width * layout.height
  const position = new BufferAttribute(new Float32Array(vertices * 3), 3)
  position.setUsage(DynamicDrawUsage)
  const normal = new BufferAttribute(new Float32Array(vertices * 3), 3)
  normal.setUsage(DynamicDrawUsage)
  const uv = new BufferAttribute(new Float32Array(vertices * 2), 2)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setAttribute('uv', uv)
  geometry.setIndex(chunkIndex(layout))
  writeChunk(geometry, samples, extent, layout, grain, edits, false)
  writeUv(uv, layout, samples)
  return geometry
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
    markChunk(position, layout.width, layout.height)
    markChunk(normal, layout.width, layout.height)
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
  markChunk(normal, layout.width, layout.height)
  normal.needsUpdate = true
}

function markChunk(attribute: BufferAttribute, width: number, height: number): void {
  const row = width * 3
  for (let z = 0; z < height; z++) attribute.addUpdateRange(z * row, row)
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

function writeUv(uv: BufferAttribute, layout: ReliefChunkLayout, samples: HeightmapSamples): void {
  if (!(uv.array instanceof Float32Array)) return
  const into = uv.array
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

function chunkIndex(layout: ReliefChunkLayout): BufferAttribute {
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
  return new BufferAttribute(indices, 1)
}
