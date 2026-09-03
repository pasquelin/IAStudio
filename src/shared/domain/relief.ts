/**
 * How a relief heightmap is cut into chunks. Grain 64 rather than 128: a full-chunk fallback
 * uploads four times less — `reliefChunkCost.test.ts`. A 4K map would want 128 instead.
 */
import { bytesFromBase64, bytesToBase64 } from '../base64'
import { clamp } from '../numeric'
import { isRecord, readString } from '../guards'
import type { HeightmapSamples } from './heightmap'

export const RELIEF_CHUNK_TEXELS = 64

export const RELIEF_CHUNK_CANDIDATES: readonly number[] = [64, 128]

/** Vertices along one edge, the shared border with the next chunk included. */
export function chunkVerticesPerSide(grain: number): number {
  return grain + 1
}

/** How many chunks cover `samples` texels on one axis. */
export function chunkCountAlong(samples: number, grain: number): number {
  return Math.max(1, Math.ceil((Math.max(1, samples) - 1) / grain))
}

export type ChunkMemory = {
  position: number
  normal: number
  uv: number
  index: number
  total: number
}

/** Bytes of one full square chunk: position + normal + uv + uint16 indices. */
export function chunkMemoryBytes(grain: number): ChunkMemory {
  const vertices = chunkVerticesPerSide(grain) ** 2
  const position = vertices * 12
  const normal = vertices * 12
  const uv = vertices * 8
  const index = grain * grain * 6 * 2
  return { position, normal, uv, index, total: position + normal + uv + index }
}

export type RegionUpload = {
  position: number
  normal: number
  total: number
}

/**
 * Bytes a partial update of a rectangular texel region uploads, normals including the 1-ring
 * the finite difference reads.
 */
export function regionUploadBytes(texelsX: number, texelsZ: number): RegionUpload {
  const position = (texelsX + 1) * (texelsZ + 1) * 12
  const normal = (texelsX + 3) * (texelsZ + 3) * 12
  return { position, normal, total: position + normal }
}

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

const SPARSE = 0
const DENSE = 1

/** Empty string when every delta is zero — the chunk is then omitted from the sculpt. */
export function packDeltas(deltas: Float32Array): string {
  let nonzero = 0
  for (let at = 0; at < deltas.length; at++) if (deltas[at] !== 0) nonzero += 1
  if (nonzero === 0) return ''
  return bytesToBase64(
    nonzero * 8 + 5 <= deltas.byteLength + 1 ? sparseOf(deltas, nonzero) : denseOf(deltas),
  )
}

export function unpackDeltas(payload: string, length: number): Float32Array {
  const out = new Float32Array(length)
  if (payload === '') return out
  const bytes = bytesFromBase64(payload)
  if (bytes.length < 1) return out
  if (bytes[0] === DENSE) {
    const body = bytes.subarray(1)
    const count = Math.min(length, Math.floor(body.byteLength / 4))
    const aligned = new Float32Array(count)
    new Uint8Array(aligned.buffer).set(body.subarray(0, count * 4))
    out.set(aligned)
    return out
  }
  if (bytes[0] !== SPARSE || bytes.length < 5) return out
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint32(1, true)
  for (let at = 0; at < count; at++) {
    const cursor = 5 + at * 8
    if (cursor + 8 > bytes.length) break
    const index = view.getUint32(cursor, true)
    if (index < length) out[index] = view.getFloat32(cursor + 4, true)
  }
  return out
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

export function chunksHoldingSample(
  sx: number,
  sz: number,
  width: number,
  height: number,
  grain: number,
): ReliefChunkKey[] {
  const out: ReliefChunkKey[] = []
  for (const column of axisHolding(sx, width, grain)) {
    for (const row of axisHolding(sz, height, grain)) out.push({ column, row })
  }
  return out
}

/**
 * A sculpt stroke the worker can run. New kinds (slope/altitude masks) join this union; they
 * must not grow a second entry point the worker would not see.
 */
export type ReliefSculptOperation = {
  kind: 'raiseDisk'
  disk: { x: number; z: number; radius: number }
  amount: number
}

export function applyReliefSculpt(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  operation: ReliefSculptOperation,
  grain = RELIEF_CHUNK_TEXELS,
): ReliefSculpt {
  switch (operation.kind) {
    case 'raiseDisk':
      return raiseReliefDisk(samples, extent, sculpt, operation.disk, operation.amount, grain)
  }
}

export function raiseReliefDisk(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  disk: { x: number; z: number; radius: number },
  amount: number,
  grain = RELIEF_CHUNK_TEXELS,
): ReliefSculpt {
  const span = diskSamples(samples, extent, disk)
  const r2 = disk.radius * disk.radius
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

  for (let row = 0; row < chunkCountAlong(samples.height, grain); row += 1) {
    for (let column = 0; column < chunkCountAlong(samples.width, grain); column += 1) {
      const layout = chunkLayout(column, row, samples.width, samples.height, grain)
      const maxX = layout.sampleX + layout.width - 1
      const maxZ = layout.sampleZ + layout.height - 1
      if (
        maxX < span.minX ||
        layout.sampleX > span.maxX ||
        maxZ < span.minZ ||
        layout.sampleZ > span.maxZ
      ) {
        continue
      }

      const key = `${column}:${row}`
      touched.add(key)
      const held = packed.get(key)
      const deltas = held
        ? unpackDeltas(held.payload, layout.width * layout.height)
        : new Float32Array(layout.width * layout.height)
      for (let sz = Math.max(span.minZ, layout.sampleZ); sz <= Math.min(span.maxZ, maxZ); sz += 1) {
        for (
          let sx = Math.max(span.minX, layout.sampleX);
          sx <= Math.min(span.maxX, maxX);
          sx += 1
        ) {
          if (
            (distanceX[sx - span.minX] ?? Infinity) + (distanceZ[sz - span.minZ] ?? Infinity) >
            r2
          ) {
            continue
          }
          const at = (sz - layout.sampleZ) * layout.width + (sx - layout.sampleX)
          deltas[at] = (deltas[at] ?? 0) + amount
        }
      }
      const payload = packDeltas(deltas)
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

export function readReliefSculpt(value: unknown): ReliefSculpt | undefined {
  if (!isRecord(value) || !Array.isArray(value.chunks)) return undefined
  return { chunks: value.chunks.flatMap(readPackedChunk) }
}

/** Grain a payload names, or the fallback. Integer ≥ 1 — a 0 or a float is not a texel count. */
export function readReliefGrain(value: unknown, fallback = RELIEF_CHUNK_TEXELS): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return fallback
  return value
}

function readPackedChunk(value: unknown): readonly PackedReliefChunk[] {
  if (!isRecord(value)) return []
  const column = value.column
  const row = value.row
  const payload = readString(value, 'payload', '')
  if (typeof column !== 'number' || typeof row !== 'number') return []
  if (!Number.isInteger(column) || !Number.isInteger(row) || payload === '') return []
  return [{ column, row, payload }]
}

function chunkIndexAt(sample: number, samples: number, grain: number): number {
  return Math.min(Math.floor(sample / grain), chunkCountAlong(samples, grain) - 1)
}

/**
 * A sample on a chunk border belongs to BOTH, so a stroke writes it twice — once per chunk.
 *
 * 🛑 The two coincide at the far edge: `chunkIndexAt` clamps to the last chunk, which is the very
 * one `sample / grain - 1` names when `(samples - 1) % grain === 0` — every 2ⁿ+1 heightmap. Handed
 * back twice, the amount was added twice to one chunk: a ridge along the far edge and a spike four
 * times too high in the corner.
 */
function axisHolding(sample: number, samples: number, grain: number): number[] {
  const primary = chunkIndexAt(sample, samples, grain)
  if (sample === 0 || sample % grain !== 0) return [primary]

  const before = sample / grain - 1
  return before === primary ? [primary] : [primary, before]
}

type LiveChunk = ReliefChunkLayout & { deltas: Float32Array }

function diskSamples(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  disk: { x: number; z: number; radius: number },
): { minX: number; maxX: number; minZ: number; maxZ: number; stepX: number; stepZ: number } {
  const stepX = extent.size.x / Math.max(1, samples.width - 1)
  const stepZ = extent.size.z / Math.max(1, samples.height - 1)
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

function sparseOf(deltas: Float32Array, nonzero: number): Uint8Array {
  const out = new Uint8Array(5 + nonzero * 8)
  const view = new DataView(out.buffer)
  out[0] = SPARSE
  view.setUint32(1, nonzero, true)
  let cursor = 5
  for (let at = 0; at < deltas.length; at++) {
    const delta = deltas[at]
    if (delta === 0 || delta === undefined) continue
    view.setUint32(cursor, at, true)
    view.setFloat32(cursor + 4, delta, true)
    cursor += 8
  }
  return out
}

function denseOf(deltas: Float32Array): Uint8Array {
  const out = new Uint8Array(1 + deltas.byteLength)
  out[0] = DENSE
  out.set(new Uint8Array(deltas.buffer, deltas.byteOffset, deltas.byteLength), 1)
  return out
}
