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
export { readReliefSculpt, readReliefMask } from './reliefParsing'
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

/** Inverse of `worldY`. A zero span maps every world Y to sample 0. */
export function sampleOfWorldY(y: number, elevation: ReliefExtent['elevation']): number {
  const span = elevation.max - elevation.min
  return span === 0 ? 0 : (y - elevation.min) / span
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
  mask?: ReliefMask
}

/**
 * Per-texel weight on an overlay. Absent mask = 1 everywhere. Painted missing chunks = 0
 * (paint-in). Height and slope are procedural on the incoming unmasked combined of the others.
 */
export type ReliefMask =
  | { kind: 'painted'; weights: ReliefSculpt }
  | { kind: 'height'; min: number; max: number }
  | { kind: 'slope'; min: number; max: number }

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
  const read = reliefReader(samples, layer.grain, layer.edits, layer)
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
  extent?: ReliefExtent,
): number {
  return reliefReader(samples, grain, overlays, extent)(sx, sz)
}

export type ReliefRead = (sx: number, sz: number) => number

/**
 * Reads base + Σ(enabled ? alpha * mask * delta) over many samples, each overlay's chunk
 * decoded once and held. A sculpt stroke rebuilds 4 225 vertices from one chunk, five reads
 * apiece — `reliefReadCost.test.ts`.
 */
export function reliefReader(
  samples: HeightmapSamples,
  grain: number,
  overlays: readonly ReliefOverlay[],
  extent?: ReliefExtent,
): ReliefRead {
  const active = overlays.filter(edit => edit.enabled && edit.alpha !== 0 && edit.sculpt)
  if (active.length === 0) return (sx, sz) => samples.values[sz * samples.width + sx] ?? 0

  const readers = active.map(edit => ({
    alpha: edit.alpha,
    deltaAt: overlayDeltaReader(samples, grain, edit.sculpt),
    mask: edit.mask,
    paintedAt:
      edit.mask?.kind === 'painted'
        ? overlayDeltaReader(samples, grain, edit.mask.weights)
        : undefined,
  }))
  const unmaskedAt = (sx: number, sz: number, except: object): number => {
    const base = samples.values[sz * samples.width + sx] ?? 0
    let added = 0
    for (const one of readers) {
      if (one === except) continue
      added += one.alpha * one.deltaAt(sx, sz)
    }
    return base + added
  }
  return (sx, sz) => {
    const base = samples.values[sz * samples.width + sx] ?? 0
    let added = 0
    for (const one of readers) {
      added +=
        one.alpha * maskWeight(one, sx, sz, unmaskedAt, samples, extent) * one.deltaAt(sx, sz)
    }
    return base + added
  }
}

function maskWeight(
  overlay: {
    mask?: ReliefMask
    paintedAt?: (sx: number, sz: number) => number
  },
  sx: number,
  sz: number,
  unmaskedAt: (sx: number, sz: number, except: object) => number,
  samples: HeightmapSamples,
  extent?: ReliefExtent,
): number {
  const mask = overlay.mask
  if (!mask) return 1
  if (mask.kind === 'painted') return clamp(overlay.paintedAt?.(sx, sz) ?? 0, 0, 1)
  if (!extent) return 1
  if (mask.kind === 'height') {
    return inRange(worldY(unmaskedAt(sx, sz, overlay), extent.elevation), mask.min, mask.max)
      ? 1
      : 0
  }
  return inRange(slopeDegrees(unmaskedAt, overlay, samples, extent, sx, sz), mask.min, mask.max)
    ? 1
    : 0
}

function slopeDegrees(
  unmaskedAt: (sx: number, sz: number, except: object) => number,
  overlay: { mask?: ReliefMask },
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sx: number,
  sz: number,
): number {
  const step = texelStep(extent.size, samples)
  const lastX = samples.width - 1
  const lastZ = samples.height - 1
  const height = (x: number, z: number): number =>
    worldY(unmaskedAt(clamp(x, 0, lastX), clamp(z, 0, lastZ), overlay), extent.elevation)
  const nx = (height(sx - 1, sz) - height(sx + 1, sz)) / (2 * step.x)
  const nz = (height(sx, sz - 1) - height(sx, sz + 1)) / (2 * step.z)
  const length = Math.hypot(nx, 1, nz) || 1
  return Math.acos(clamp(1 / length, -1, 1)) * (180 / Math.PI)
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= Math.min(min, max) && value <= Math.max(min, max)
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

export type ReliefDisk = { x: number; z: number; radius: number }

type ReliefDiskStroke = {
  disk: ReliefDisk
  amount: number
  /** 0 = hard edge (the historical disk). 1 = linear from full at the centre to none at the rim. */
  falloff?: number
}

/**
 * A sculpt stroke the worker can run. New kinds join this union; they must not grow a second
 * entry point the worker would not see.
 */
export type ReliefSculptOperation =
  | ({ kind: 'raiseDisk' } & ReliefDiskStroke)
  | ({ kind: 'smooth' } & ReliefDiskStroke)
  | ({ kind: 'flatten'; target: number } & ReliefDiskStroke)
  | ({ kind: 'paintMask' } & ReliefDiskStroke)

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
  overlays: readonly ReliefOverlay[] = [],
  armed?: { alpha: number; mask?: ReliefMask },
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
    case 'smooth':
      return smoothReliefDisk(
        samples,
        extent,
        sculpt,
        operation.disk,
        operation.amount,
        operation.falloff ?? 0,
        grain,
        rows,
        overlays,
        armed,
      )
    case 'flatten':
      return flattenReliefDisk(
        samples,
        extent,
        sculpt,
        operation.disk,
        operation.target,
        operation.amount,
        operation.falloff ?? 0,
        grain,
        rows,
        overlays,
        armed,
      )
    case 'paintMask':
      return paintReliefMask(
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
  disk: ReliefDisk,
  amount: number,
  falloff = 0,
  grain = RELIEF_CHUNK_TEXELS,
  rows?: ReliefChunkRows,
): ReliefSculpt {
  return addDiskDeltas(
    samples,
    extent,
    sculpt,
    disk,
    falloff,
    grain,
    rows,
    (_sx, _sz, weight) => amount * weight,
  )
}

/**
 * Pulls combined height toward the 3×3 neighbourhood mean. The correction is written into
 * `sculpt` so disabling that overlay restores the surface — never mutates the base or others.
 */
export function smoothReliefDisk(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  disk: ReliefDisk,
  amount: number,
  falloff = 0,
  grain = RELIEF_CHUNK_TEXELS,
  rows?: ReliefChunkRows,
  overlays: readonly ReliefOverlay[] = [],
  armed?: { alpha: number; mask?: ReliefMask },
): ReliefSculpt {
  const read = combinedRead(samples, grain, overlays, sculpt, extent, armed)
  return addDiskDeltas(samples, extent, sculpt, disk, falloff, grain, rows, (sx, sz, weight) => {
    const combined = read(sx, sz)
    return (neighbourMean(read, samples, sx, sz) - combined) * amount * weight
  })
}

/**
 * Pulls combined height toward `target` (sample space). Same write rule as smooth: the
 * armed overlay holds the correction.
 */
export function flattenReliefDisk(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  disk: ReliefDisk,
  target: number,
  amount: number,
  falloff = 0,
  grain = RELIEF_CHUNK_TEXELS,
  rows?: ReliefChunkRows,
  overlays: readonly ReliefOverlay[] = [],
  armed?: { alpha: number; mask?: ReliefMask },
): ReliefSculpt {
  const read = combinedRead(samples, grain, overlays, sculpt, extent, armed)
  return addDiskDeltas(
    samples,
    extent,
    sculpt,
    disk,
    falloff,
    grain,
    rows,
    (sx, sz, weight) => (target - read(sx, sz)) * amount * weight,
  )
}

/** Mixes brush strength into a painted mask. Rim keeps the previous weight so overlapping dabs hold. */
export function paintReliefMask(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  weights: ReliefSculpt | undefined,
  disk: ReliefDisk,
  amount: number,
  falloff = 0,
  grain = RELIEF_CHUNK_TEXELS,
  rows?: ReliefChunkRows,
): ReliefSculpt {
  return addDiskDeltas(
    samples,
    extent,
    weights,
    disk,
    falloff,
    grain,
    rows,
    () => clamp(amount, 0, 1),
    'mix',
  )
}

function combinedRead(
  samples: HeightmapSamples,
  grain: number,
  overlays: readonly ReliefOverlay[],
  sculpt: ReliefSculpt | undefined,
  extent?: ReliefExtent,
  armed?: { alpha: number; mask?: ReliefMask },
): ReliefRead {
  return reliefReader(
    samples,
    grain,
    [
      ...overlays,
      ...(sculpt ? [{ enabled: true, alpha: armed?.alpha ?? 1, sculpt, mask: armed?.mask }] : []),
    ],
    extent,
  )
}

function neighbourMean(
  read: ReliefRead,
  samples: HeightmapSamples,
  sx: number,
  sz: number,
): number {
  let sum = 0
  let count = 0
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = sx + dx
      const z = sz + dz
      if (x < 0 || z < 0 || x >= samples.width || z >= samples.height) continue
      sum += read(x, z)
      count += 1
    }
  }
  return count === 0 ? 0 : sum / count
}

function addDiskDeltas(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  disk: ReliefDisk,
  falloff: number,
  grain: number,
  rows: ReliefChunkRows | undefined,
  deltaAt: (sx: number, sz: number, weight: number) => number,
  write: 'add' | 'set' | 'mix' = 'add',
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
  const context = {
    samples,
    span,
    disk,
    falloff,
    grain,
    distanceX,
    distanceZ,
    packed,
    deltaAt,
    write,
  }
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
  disk: ReliefDisk
  falloff: number
  grain: number
  distanceX: Float64Array
  distanceZ: Float64Array
  packed: ReadonlyMap<string, PackedReliefChunk>
  deltaAt: (sx: number, sz: number, weight: number) => number
  write: 'add' | 'set' | 'mix'
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
  const { span, disk, distanceX, distanceZ, falloff, deltaAt, write } = context
  for (let sz = Math.max(span.minZ, layout.sampleZ); sz <= Math.min(span.maxZ, maxZ); sz += 1) {
    for (let sx = Math.max(span.minX, layout.sampleX); sx <= Math.min(span.maxX, maxX); sx += 1) {
      const d2 = (distanceX[sx - span.minX] ?? Infinity) + (distanceZ[sz - span.minZ] ?? Infinity)
      if (d2 > disk.radius * disk.radius) continue
      const at = (sz - layout.sampleZ) * layout.width + (sx - layout.sampleX)
      const weight = falloff <= 0 ? 1 : diskFalloff(Math.sqrt(d2), disk.radius, falloff)
      const next = deltaAt(sx, sz, weight)
      const held = deltas[at] ?? 0
      deltas[at] =
        write === 'mix' ? held + (next - held) * weight : write === 'set' ? next : held + next
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
