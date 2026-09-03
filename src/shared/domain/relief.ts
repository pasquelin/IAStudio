/**
 * How a relief heightmap is cut into chunks. Grain 64 rather than 128: a full-chunk fallback
 * uploads four times less — `reliefChunkCost.test.ts`. A 4K map would want 128 instead.
 */
import { isRecord, readNumber, readString } from '../guards'
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
  grain: number
  chunks: readonly PackedReliefChunk[]
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
    width: Math.min(grain, Math.max(0, width - 1 - sampleX)) + 1,
    height: Math.min(grain, Math.max(0, height - 1 - sampleZ)) + 1,
  }
}

const SPARSE = 0
const DENSE = 1

/** Empty string when every delta is zero — the chunk is then omitted from the sculpt. */
export function packDeltas(deltas: Float32Array): string {
  let nonzero = 0
  for (let at = 0; at < deltas.length; at++) if (deltas[at] !== 0) nonzero += 1
  if (nonzero === 0) return ''
  return payloadOf(
    nonzero * 8 + 5 <= deltas.byteLength + 1 ? sparseOf(deltas, nonzero) : denseOf(deltas),
  )
}

export function unpackDeltas(payload: string, length: number): Float32Array {
  const out = new Float32Array(length)
  if (payload === '') return out
  const bytes = bytesOf(payload)
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
): ReliefSculpt {
  const grain = sculpt?.grain ?? RELIEF_CHUNK_TEXELS
  const layout = chunkLayout(at.column, at.row, samples.width, samples.height, grain)
  const held = sculpt?.chunks.find(chunk => chunk.column === at.column && chunk.row === at.row)
  const deltas = held
    ? unpackDeltas(held.payload, layout.width * layout.height)
    : new Float32Array(layout.width * layout.height)
  const index = at.localZ * layout.width + at.localX
  deltas[index] = (deltas[index] ?? 0) + at.delta
  return replaceChunk(sculpt, grain, at, packDeltas(deltas))
}

/**
 * Base plus sculpt at one sample. 🛑 A loop over samples wants `reliefReader` instead: this
 * decodes the whole chunk it lands in, every call.
 */
export function combinedAt(
  samples: HeightmapSamples,
  sculpt: ReliefSculpt | undefined,
  sx: number,
  sz: number,
): number {
  return reliefReader(samples, sculpt)(sx, sz)
}

export type ReliefRead = (sx: number, sz: number) => number

/**
 * Reads base + sculpt over many samples, each chunk decoded once and held. A sculpt stroke
 * rebuilds 4 225 vertices from one chunk, five reads apiece — `reliefReadCost.test.ts`.
 */
export function reliefReader(
  samples: HeightmapSamples,
  sculpt: ReliefSculpt | undefined,
): ReliefRead {
  if (!sculpt) return (sx, sz) => samples.values[sz * samples.width + sx] ?? 0
  // Decoded on first touch, not up front: one chunk's rebuild reads its own payload and the
  // 1-ring of its neighbours, never the whole sculpt — which a 4K map cuts into 4 096 chunks.
  const live = new Map<string, LiveChunk | null>()
  return (sx, sz) => {
    const base = samples.values[sz * samples.width + sx] ?? 0
    const column = chunkIndexAt(sx, samples.width, sculpt.grain)
    const row = chunkIndexAt(sz, samples.height, sculpt.grain)
    const key = `${column}:${row}`
    let held = live.get(key)
    if (held === undefined) {
      held = decodedChunk(samples, sculpt, { column, row })
      live.set(key, held)
    }
    if (!held) return base
    return base + (held.deltas[(sz - held.sampleZ) * held.width + (sx - held.sampleX)] ?? 0)
  }
}

function decodedChunk(
  samples: HeightmapSamples,
  sculpt: ReliefSculpt,
  key: ReliefChunkKey,
): LiveChunk | null {
  const packed = sculpt.chunks.find(one => one.column === key.column && one.row === key.row)
  if (!packed) return null
  const layout = chunkLayout(key.column, key.row, samples.width, samples.height, sculpt.grain)
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
  const keys = new Map<string, ReliefChunkKey>()
  for (const chunk of [...(before?.chunks ?? []), ...after.chunks]) {
    keys.set(`${chunk.column}:${chunk.row}`, { column: chunk.column, row: chunk.row })
  }
  const edits: PackedReliefChunk[] = []
  for (const { column, row } of keys.values()) {
    const payload = chunkPayload(after, column, row)
    if (payload === chunkPayload(before, column, row)) continue
    edits.push({ column, row, payload })
  }
  return edits
}

export function withPackedChunks(
  sculpt: ReliefSculpt | undefined,
  grain: number,
  edits: readonly PackedReliefChunk[],
): ReliefSculpt {
  let next = sculpt ?? { grain, chunks: [] }
  for (const edit of edits) next = replaceChunk(next, grain, edit, edit.payload)
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
): ReliefSculpt {
  switch (operation.kind) {
    case 'raiseDisk':
      return raiseReliefDisk(samples, extent, sculpt, operation.disk, operation.amount)
  }
}

export function raiseReliefDisk(
  samples: HeightmapSamples,
  extent: ReliefExtent,
  sculpt: ReliefSculpt | undefined,
  disk: { x: number; z: number; radius: number },
  amount: number,
): ReliefSculpt {
  const grain = sculpt?.grain ?? RELIEF_CHUNK_TEXELS
  const live = liveChunksOf(samples, sculpt, grain)
  const span = diskSamples(samples, extent, disk)
  const r2 = disk.radius * disk.radius
  for (let sz = span.minZ; sz <= span.maxZ; sz++) {
    for (let sx = span.minX; sx <= span.maxX; sx++) {
      const wx = extent.origin.x + sx * span.stepX
      const wz = extent.origin.z + sz * span.stepZ
      if ((wx - disk.x) ** 2 + (wz - disk.z) ** 2 > r2) continue
      raiseSample(live, samples, grain, sx, sz, amount)
    }
  }
  return sculptOfLive(grain, live)
}

export function readReliefSculpt(value: unknown): ReliefSculpt | undefined {
  if (!isRecord(value)) return undefined
  const grain = readNumber(value, 'grain', RELIEF_CHUNK_TEXELS)
  if (!Number.isInteger(grain) || grain < 1 || !Array.isArray(value.chunks)) return undefined
  const chunks = value.chunks.flatMap(readPackedChunk)
  return { grain, chunks }
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

function axisHolding(sample: number, samples: number, grain: number): number[] {
  const primary = chunkIndexAt(sample, samples, grain)
  if (sample > 0 && sample % grain === 0) return [primary, sample / grain - 1]
  return [primary]
}

type LiveChunk = ReliefChunkLayout & { deltas: Float32Array }

function liveChunksOf(
  samples: HeightmapSamples,
  sculpt: ReliefSculpt | undefined,
  grain: number,
): Map<string, LiveChunk> {
  const live = new Map<string, LiveChunk>()
  for (const packed of sculpt?.chunks ?? []) {
    const layout = chunkLayout(packed.column, packed.row, samples.width, samples.height, grain)
    live.set(`${packed.column}:${packed.row}`, {
      ...layout,
      deltas: unpackDeltas(packed.payload, layout.width * layout.height),
    })
  }
  return live
}

function raiseSample(
  live: Map<string, LiveChunk>,
  samples: HeightmapSamples,
  grain: number,
  sx: number,
  sz: number,
  amount: number,
): void {
  for (const key of chunksHoldingSample(sx, sz, samples.width, samples.height, grain)) {
    const id = `${key.column}:${key.row}`
    const held = live.get(id) ?? emptyLive(key, samples, grain)
    if (!live.has(id)) live.set(id, held)
    const index = (sz - held.sampleZ) * held.width + (sx - held.sampleX)
    held.deltas[index] = (held.deltas[index] ?? 0) + amount
  }
}

function emptyLive(key: ReliefChunkKey, samples: HeightmapSamples, grain: number): LiveChunk {
  const layout = chunkLayout(key.column, key.row, samples.width, samples.height, grain)
  return { ...layout, deltas: new Float32Array(layout.width * layout.height) }
}

function sculptOfLive(grain: number, live: Map<string, LiveChunk>): ReliefSculpt {
  const chunks: PackedReliefChunk[] = []
  for (const chunk of live.values()) {
    const payload = packDeltas(chunk.deltas)
    if (payload !== '') chunks.push({ column: chunk.column, row: chunk.row, payload })
  }
  return { grain, chunks }
}

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
  return Math.min(samples - 1, Math.max(0, at))
}

function replaceChunk(
  sculpt: ReliefSculpt | undefined,
  grain: number,
  at: ReliefChunkKey,
  payload: string,
): ReliefSculpt {
  const others = (sculpt?.chunks ?? []).filter(
    chunk => chunk.column !== at.column || chunk.row !== at.row,
  )
  return {
    grain,
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

function payloadOf(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let at = 0; at < bytes.length; at += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(at, at + 0x8000)))
  }
  return btoa(chunks.join(''))
}

function bytesOf(payload: string): Uint8Array {
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at)
  return bytes
}
