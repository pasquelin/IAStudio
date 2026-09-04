/**
 * How a relief heightmap is cut into chunks. Grain 64 rather than 128: a full-chunk fallback
 * uploads four times less — `reliefChunkCost.test.ts`. A 4K map would want 128 instead.
 */
import { clamp } from '../numeric'
import type { HeightmapSamples } from './heightmap'
import { packDeltas, unpackDeltas } from './reliefPacking'
import { readReliefGrain as readGrain } from './reliefParsing'
import { chunkCountAlong, RELIEF_CHUNK_TEXELS } from './reliefMetrics'

export { packDeltas, unpackDeltas } from './reliefPacking'
export { readReliefSculpt } from './reliefParsing'
export * from './reliefMetrics'

export type ReliefOrigin = { x: number; z: number }
export type ReliefSize = { x: number; z: number }

export type ReliefExtent = {
  origin: ReliefOrigin
  size: ReliefSize
  elevation: { min: number; max: number }
}

/** Sample 0 → elevation.min, sample 1 → elevation.max. Identity is `{ min: 0, max: 1 }`. */
export function worldY(sample: number, elevation: ReliefExtent['elevation']): number {
  return elevation.min + sample * (elevation.max - elevation.min)
}

/** World units from one texel to the next along X and Z. */
export function texelStep(
  size: ReliefSize,
  samples: { width: number; height: number },
): ReliefSize {
  return {
    x: size.x / Math.max(1, samples.width - 1),
    z: size.z / Math.max(1, samples.height - 1),
  }
}

/** Whether (x, z) sits on the rectangle, edges included. Outside is false — never clamped in. */
export function containsXZ(extent: ReliefExtent, x: number, z: number): boolean {
  return (
    x >= extent.origin.x &&
    x <= extent.origin.x + extent.size.x &&
    z >= extent.origin.z &&
    z <= extent.origin.z + extent.size.z
  )
}

export type ReliefChunkKey = { column: number; row: number }

export type ReliefChunkLayout = ReliefChunkKey & {
  sampleX: number
  sampleZ: number
  width: number
  height: number
}

/** One chunk's deltas as the file holds them: base64 of sparse or dense float32, never JSON floats. */
export type PackedReliefChunk = ReliefChunkKey & { payload: string }

export type ReliefSculpt = {
  chunks: readonly PackedReliefChunk[]
}

/**
 * One edit's contribution to a combined height. Identity (id, name, locked) lives on
 * `TerrainEditLayer` — this is the blend the height functions read.
 */
export type ReliefOverlay = {
  enabled: boolean
  alpha: number
  sculpt?: ReliefSculpt
}

/**
 * A height query: the spatial half of a relief plus the samples the heightmap asset holds.
 * `ReliefLayer` matches this shape once `samples` is attached — the asset stays a `TextureRef`.
 */
export type ReliefHeightLayer = ReliefExtent & {
  enabled: boolean
  grain: number
  edits: readonly ReliefOverlay[]
  samples: HeightmapSamples
}

/**
 * World Y at (x, z): first enabled layer whose extent contains the point, bilinear sample.
 * Overlapping extents: the earlier entry wins. None contain the point → null.
 */
export function getHeightAt(
  layers: readonly ReliefHeightLayer[],
  x: number,
  z: number,
): number | null {
  const layer = layers.find(one => one.enabled && containsXZ(one, x, z))
  if (!layer) return null

  const { samples } = layer
  const step = texelStep(layer.size, samples)
  const tx = (x - layer.origin.x) / step.x
  const tz = (z - layer.origin.z) / step.z
  const lastX = samples.width - 1
  const lastZ = samples.height - 1
  const x0 = clamp(Math.floor(tx), 0, lastX)
  const z0 = clamp(Math.floor(tz), 0, lastZ)
  const x1 = Math.min(x0 + 1, lastX)
  const z1 = Math.min(z0 + 1, lastZ)
  const read = reliefReader(samples, layer.grain, layer.edits)
  const sample = mix(
    mix(read(x0, z0), read(x1, z0), tx - x0),
    mix(read(x0, z1), read(x1, z1), tx - x0),
    tz - z0,
  )
  return worldY(sample, layer.elevation)
}

export function chunkLayout(
  column: number,
  row: number,
  width: number,
  height: number,
  grain: number,
): ReliefChunkLayout {
  const sampleX = column * grain
  const sampleZ = row * grain
  return {
    column,
    row,
    sampleX,
    sampleZ,
    width: clamp(width - 1 - sampleX, 0, grain) + 1,
    height: clamp(height - 1 - sampleZ, 0, grain) + 1,
  }
}

export function withChunkDelta(
  samples: HeightmapSamples,
  sculpt: ReliefSculpt | undefined,
  at: ReliefChunkKey & { localX: number; localZ: number; delta: number },
  grain = RELIEF_CHUNK_TEXELS,
): ReliefSculpt {
  const layout = chunkLayout(at.column, at.row, samples.width, samples.height, grain)
  const held = sculpt?.chunks.find(chunk => chunk.column === at.column && chunk.row === at.row)
  const deltas = held
    ? unpackDeltas(held.payload, layout.width * layout.height)
    : new Float32Array(layout.width * layout.height)
  const index = at.localZ * layout.width + at.localX
  deltas[index] = (deltas[index] ?? 0) + at.delta
  return replaceChunk(sculpt, at, packDeltas(deltas))
}

/**
 * Base plus the enabled overlays at one sample. 🛑 A loop over samples wants `reliefReader`
 * instead: this decodes the whole chunk it lands in, every call.
 */
export function combinedAt(
  samples: HeightmapSamples,
  grain: number,
  overlays: readonly ReliefOverlay[],
  sx: number,
  sz: number,
): number {
  return reliefReader(samples, grain, overlays)(sx, sz)
}

export type ReliefRead = (sx: number, sz: number) => number

/**
 * Reads base + Σ(enabled ? alpha * delta) over many samples, each overlay's chunk decoded once
 * and held. A sculpt stroke rebuilds 4 225 vertices from one chunk, five reads apiece —
 * `reliefReadCost.test.ts`.
 */
export function reliefReader(
  samples: HeightmapSamples,
  grain: number,
  overlays: readonly ReliefOverlay[],
): ReliefRead {
  const active = overlays.filter(edit => edit.enabled && edit.alpha !== 0 && edit.sculpt)
  if (active.length === 0) return (sx, sz) => samples.values[sz * samples.width + sx] ?? 0

  const readers = active.map(edit => ({
    alpha: edit.alpha,
    deltaAt: overlayDeltaReader(samples, grain, edit.sculpt),
  }))
  return (sx, sz) => {
    const base = samples.values[sz * samples.width + sx] ?? 0
    let added = 0
    for (const one of readers) added += one.alpha * one.deltaAt(sx, sz)
    return base + added
  }
}

function overlayDeltaReader(
  samples: HeightmapSamples,
  grain: number,
  sculpt: ReliefSculpt | undefined,
): (sx: number, sz: number) => number {
  if (!sculpt) return () => 0
  // Decoded on first touch, not up front: one chunk's rebuild reads its own payload and the
  // 1-ring of its neighbours, never the whole sculpt — which a 4K map cuts into 4 096 chunks.
  const live = new Map<string, LiveChunk | null>()
  return (sx, sz) => {
    const column = chunkIndexAt(sx, samples.width, grain)
    const row = chunkIndexAt(sz, samples.height, grain)
    const key = `${column}:${row}`
    let held = live.get(key)
    if (held === undefined) {
      held = decodedChunk(samples, sculpt, grain, { column, row })
      live.set(key, held)
    }
    if (!held) return 0
    return held.deltas[(sz - held.sampleZ) * held.width + (sx - held.sampleX)] ?? 0
  }
}

function decodedChunk(
  samples: HeightmapSamples,
  sculpt: ReliefSculpt,
  grain: number,
  key: ReliefChunkKey,
): LiveChunk | null {
  const packed = sculpt.chunks.find(one => one.column === key.column && one.row === key.row)
  if (!packed) return null
  const layout = chunkLayout(key.column, key.row, samples.width, samples.height, grain)
  return { ...layout, deltas: unpackDeltas(packed.payload, layout.width * layout.height) }
}

export function chunkPayload(
  sculpt: ReliefSculpt | undefined,
  column: number,
  row: number,
): string {
  return sculpt?.chunks.find(chunk => chunk.column === column && chunk.row === row)?.payload ?? ''
}

export function changedChunks(
  before: ReliefSculpt | undefined,
  after: ReliefSculpt,
): PackedReliefChunk[] {
  // Indexed once rather than searched per key: a `.find` on both sides made this quadratic, which
  // a 1024² map turns into ~131 000 comparisons for every movement of the brush.
  const held = payloadsOf(before)
  const wanted = payloadsOf(after)
  const edits: PackedReliefChunk[] = []
  for (const [key, { column, row }] of new Map([...held, ...wanted])) {
    const payload = wanted.get(key)?.payload ?? ''
    if (payload === (held.get(key)?.payload ?? '')) continue
    edits.push({ column, row, payload })
  }
  return edits
}

function payloadsOf(sculpt: ReliefSculpt | undefined): Map<string, PackedReliefChunk> {
  return new Map((sculpt?.chunks ?? []).map(chunk => [`${chunk.column}:${chunk.row}`, chunk]))
}

export function withPackedChunks(
  sculpt: ReliefSculpt | undefined,
  edits: readonly PackedReliefChunk[],
): ReliefSculpt {
  let next = sculpt ?? { chunks: [] }
  for (const edit of edits) next = replaceChunk(next, edit, edit.payload)
  return next
}

/**
 * A sculpt stroke the worker can run. New kinds (slope/altitude masks) join this union; they
 * must not grow a second entry point the worker would not see.
 */
export type ReliefSculptOperation = {
  kind: 'raiseDisk'
  disk: { x: number; z: number; radius: number }
  amount: number
  /** 0 = hard edge (the historical disk). 1 = linear from full at the centre to none at the rim. */
  falloff?: number
}

export type ReliefChunkRows = { from: number; to: number }

export function reliefChunkRowsInDisk(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  disk: { x: number; z: number; radius: number },
  grain: number,
): ReliefChunkRows {
  const span = diskSamples(samples, extent, disk)
  const rows = Array.from({ length: chunkCountAlong(samples.height, grain) }, (_, row) =>
    chunkLayout(0, row, samples.width, samples.height, grain),
  ).filter(layout => {
    const maxZ = layout.sampleZ + layout.height - 1
    return maxZ >= span.minZ && layout.sampleZ <= span.maxZ
  })
  return { from: rows[0]?.row ?? 0, to: (rows.at(-1)?.row ?? 0) + 1 }
}

export function applyReliefSculpt(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  operation: ReliefSculptOperation,
  grain = RELIEF_CHUNK_TEXELS,
  rows?: ReliefChunkRows,
): ReliefSculpt {
  switch (operation.kind) {
    case 'raiseDisk':
      return raiseReliefDisk(
        samples,
        extent,
        sculpt,
        operation.disk,
        operation.amount,
        operation.falloff ?? 0,
        grain,
        rows,
      )
  }
}

export function raiseReliefDisk(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  disk: { x: number; z: number; radius: number },
  amount: number,
  falloff = 0,
  grain = RELIEF_CHUNK_TEXELS,
  rows?: ReliefChunkRows,
): ReliefSculpt {
  const span = diskSamples(samples, extent, disk)
  const distanceX = Float64Array.from({ length: span.maxX - span.minX + 1 }, (_, at) => {
    const dx = extent.origin.x + (span.minX + at) * span.stepX - disk.x
    return dx * dx
  })
  const distanceZ = Float64Array.from({ length: span.maxZ - span.minZ + 1 }, (_, at) => {
    const dz = extent.origin.z + (span.minZ + at) * span.stepZ - disk.z
    return dz * dz
  })
  const updated = new Map<string, PackedReliefChunk>()
  const touched = new Set<string>()
  const packed = payloadsOf(sculpt)
  const rowFrom = rows?.from ?? 0
  const rowTo = rows?.to ?? chunkCountAlong(samples.height, grain)
  const context = { samples, span, disk, amount, falloff, grain, distanceX, distanceZ, packed }
  for (let row = rowFrom; row < rowTo; row += 1) {
    for (let column = 0; column < chunkCountAlong(samples.width, grain); column += 1) {
      const key = `${column}:${row}`
      const payload = raisedChunk(context, column, row, key)
      if (payload === null) continue
      touched.add(key)
      if (payload !== '') updated.set(key, { column, row, payload })
    }
  }

  const chunks = (sculpt?.chunks ?? []).flatMap(chunk => {
    const key = `${chunk.column}:${chunk.row}`
    const replacement = updated.get(key)
    updated.delete(key)
    return replacement ? [replacement] : touched.has(key) ? [] : [chunk]
  })
  return { chunks: [...chunks, ...updated.values()] }
}

type RaiseContext = {
  samples: HeightmapSamples
  span: ReturnType<typeof diskSamples>
  disk: { x: number; z: number; radius: number }
  amount: number
  falloff: number
  grain: number
  distanceX: Float64Array
  distanceZ: Float64Array
  packed: ReadonlyMap<string, PackedReliefChunk>
}

function raisedChunk(
  context: RaiseContext,
  column: number,
  row: number,
  key: string,
): string | null {
  const { samples, grain, span } = context
  const layout = chunkLayout(column, row, samples.width, samples.height, grain)
  const maxX = layout.sampleX + layout.width - 1
  const maxZ = layout.sampleZ + layout.height - 1
  if (
    maxX < span.minX ||
    layout.sampleX > span.maxX ||
    maxZ < span.minZ ||
    layout.sampleZ > span.maxZ
  )
    return null
  const held = context.packed.get(key)
  const deltas = held
    ? unpackDeltas(held.payload, layout.width * layout.height)
    : new Float32Array(layout.width * layout.height)
  raiseChunkSamples(context, layout, deltas, maxX, maxZ)
  return packDeltas(deltas)
}

function raiseChunkSamples(
  context: RaiseContext,
  layout: ReliefChunkLayout,
  deltas: Float32Array,
  maxX: number,
  maxZ: number,
): void {
  const { span, disk, distanceX, distanceZ, amount, falloff } = context
  for (let sz = Math.max(span.minZ, layout.sampleZ); sz <= Math.min(span.maxZ, maxZ); sz += 1) {
    for (let sx = Math.max(span.minX, layout.sampleX); sx <= Math.min(span.maxX, maxX); sx += 1) {
      const d2 = (distanceX[sx - span.minX] ?? Infinity) + (distanceZ[sz - span.minZ] ?? Infinity)
      if (d2 > disk.radius * disk.radius) continue
      const at = (sz - layout.sampleZ) * layout.width + (sx - layout.sampleX)
      const strength =
        falloff <= 0 ? amount : amount * diskFalloff(Math.sqrt(d2), disk.radius, falloff)
      deltas[at] = (deltas[at] ?? 0) + strength
    }
  }
}

/** Grain a payload names, or the fallback. Integer ≥ 1 — a 0 or a float is not a texel count. */
export function readReliefGrain(value: unknown, fallback = RELIEF_CHUNK_TEXELS): number {
  return readGrain(value, fallback)
}

function chunkIndexAt(sample: number, samples: number, grain: number): number {
  return Math.min(Math.floor(sample / grain), chunkCountAlong(samples, grain) - 1)
}

type LiveChunk = ReliefChunkLayout & { deltas: Float32Array }

function diskSamples(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  disk: { x: number; z: number; radius: number },
): { minX: number; maxX: number; minZ: number; maxZ: number; stepX: number; stepZ: number } {
  const { x: stepX, z: stepZ } = texelStep(extent.size, samples)
  return {
    stepX,
    stepZ,
    minX: clampIndex(Math.floor((disk.x - disk.radius - extent.origin.x) / stepX), samples.width),
    maxX: clampIndex(Math.ceil((disk.x + disk.radius - extent.origin.x) / stepX), samples.width),
    minZ: clampIndex(Math.floor((disk.z - disk.radius - extent.origin.z) / stepZ), samples.height),
    maxZ: clampIndex(Math.ceil((disk.z + disk.radius - extent.origin.z) / stepZ), samples.height),
  }
}

function clampIndex(at: number, samples: number): number {
  return clamp(at, 0, samples - 1)
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function diskFalloff(distance: number, radius: number, falloff: number): number {
  if (falloff <= 0 || radius <= 0) return 1
  const t = distance / radius
  const start = 1 - clamp(falloff, 0, 1)
  if (t <= start) return 1
  return 1 - (t - start) / (1 - start)
}

function replaceChunk(
  sculpt: ReliefSculpt | undefined,
  at: ReliefChunkKey,
  payload: string,
): ReliefSculpt {
  const others = (sculpt?.chunks ?? []).filter(
    chunk => chunk.column !== at.column || chunk.row !== at.row,
  )
  return {
    chunks: payload === '' ? others : [...others, { column: at.column, row: at.row, payload }],
  }
}
