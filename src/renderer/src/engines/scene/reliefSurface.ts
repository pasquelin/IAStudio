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
  RELIEF_CHUNK_TEXELS,
  changedChunks,
  chunkCountAlong,
  chunkLayout,
  reliefReader,
  worldY,
  type ReliefChunkLayout,
  type ReliefExtent,
  type ReliefRead,
  type ReliefSculpt,
} from '@shared/domain/relief'
import type { ReliefLayer, SceneWorld } from '@shared/domain/scene'
import { loadHeightmap } from './heightmap'

export type ReliefSurface = {
  object: Object3D
  sync: (world: SceneWorld, samples?: HeightmapSamples) => void
  meshOf: (column: number, row: number) => Mesh | undefined
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
  sculpt: ReliefSculpt | undefined
}

type SurfaceState = {
  group: Group
  material: MeshStandardMaterial
  meshes: Map<string, Mesh>
  held: Held | null
  generation: number
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
    meshes: new Map(),
    held: null,
    generation: 0,
    options,
    load: options.load ?? (assetId => loadHeightmap(assetId)),
  }
  state.group.name = RELIEF_NAME
  scene.add(state.group)
  return {
    object: state.group,
    sync: (world, samples) => syncRelief(state, world, samples),
    meshOf: (column, row) => state.meshes.get(keyOf(column, row)),
    dispose: () => disposeRelief(state),
  }
}

function syncRelief(state: SurfaceState, world: SceneWorld, samples?: HeightmapSamples): void {
  const layer = world.layers.find(item => item.kind === 'relief')
  if (!layer) {
    state.generation += 1
    state.held = null
    clearMeshes(state.meshes)
    return
  }
  if (samples) {
    applyLayer(state, layer, samples)
    return
  }
  if (state.held?.assetId === layer.heightmap.assetId) {
    applyLayer(state, layer, state.held.samples)
    return
  }
  void loadLayer(state, layer)
}

function applyLayer(state: SurfaceState, layer: ReliefLayer, samples: HeightmapSamples): void {
  const grain = layer.sculpt?.grain ?? RELIEF_CHUNK_TEXELS
  const extent: ReliefExtent = {
    origin: layer.origin,
    size: layer.size,
    elevation: layer.elevation,
  }
  if (needsRebuild(state.held, samples, grain, extent)) {
    clearMeshes(state.meshes)
    buildMeshes(state, samples, extent, grain, layer.sculpt)
  } else {
    patchMeshes(state, samples, extent, grain, state.held?.sculpt, layer.sculpt)
  }
  state.held = { assetId: layer.heightmap.assetId, samples, extent, grain, sculpt: layer.sculpt }
}

function needsRebuild(
  held: Held | null,
  samples: HeightmapSamples,
  grain: number,
  extent: ReliefExtent,
): boolean {
  if (!held || held.samples !== samples || held.grain !== grain) return true
  return (
    held.extent.origin.x !== extent.origin.x ||
    held.extent.origin.z !== extent.origin.z ||
    held.extent.size.x !== extent.size.x ||
    held.extent.size.z !== extent.size.z ||
    held.extent.elevation.min !== extent.elevation.min ||
    held.extent.elevation.max !== extent.elevation.max
  )
}

async function loadLayer(state: SurfaceState, layer: ReliefLayer): Promise<void> {
  const token = ++state.generation
  try {
    const samples = await state.load(layer.heightmap.assetId)
    if (token !== state.generation) return
    applyLayer(state, layer, samples)
    state.options.onReady?.()
  } catch (error) {
    if (token !== state.generation) return
    state.options.onFailure?.(layer.heightmap.assetId, error)
  }
}

function disposeRelief(state: SurfaceState): void {
  state.generation += 1
  clearMeshes(state.meshes)
  state.material.dispose()
  state.group.removeFromParent()
}

function buildMeshes(
  state: SurfaceState,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  grain: number,
  sculpt: ReliefSculpt | undefined,
): void {
  const columns = chunkCountAlong(samples.width, grain)
  const rows = chunkCountAlong(samples.height, grain)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const layout = chunkLayout(column, row, samples.width, samples.height, grain)
      const mesh = new Mesh(chunkGeometry(samples, extent, layout, sculpt), state.material)
      mesh.name = `relief-chunk-${column}-${row}`
      mesh.castShadow = false
      mesh.receiveShadow = true
      state.group.add(mesh)
      state.meshes.set(keyOf(column, row), mesh)
    }
  }
}

function patchMeshes(
  state: SurfaceState,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  grain: number,
  before: ReliefSculpt | undefined,
  after: ReliefSculpt | undefined,
): void {
  for (const mesh of state.meshes.values()) clearChunkRanges(mesh)
  for (const { column, row } of changedChunks(before, after ?? { grain, chunks: [] })) {
    const mesh = state.meshes.get(keyOf(column, row))
    if (!mesh) continue
    const layout = chunkLayout(column, row, samples.width, samples.height, grain)
    writeChunk(mesh.geometry, samples, extent, layout, after, true)
  }
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
  sculpt: ReliefSculpt | undefined,
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
  writeChunk(geometry, samples, extent, layout, sculpt, false)
  writeUv(uv, layout, samples)
  return geometry
}

function writeChunk(
  geometry: BufferGeometry,
  samples: HeightmapSamples,
  extent: ReliefExtent,
  layout: ReliefChunkLayout,
  sculpt: ReliefSculpt | undefined,
  ranged: boolean,
): void {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!(position instanceof BufferAttribute) || !(normal instanceof BufferAttribute)) return
  if (!(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array)) return
  const read = reliefReader(samples, sculpt)
  writePositions(position.array, samples, extent, layout, read)
  writeNormals(normal.array, samples, extent, layout, read)
  if (ranged) {
    markChunk(position, layout.width, layout.height)
    markChunk(normal, layout.width, layout.height)
  }
  position.needsUpdate = true
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
