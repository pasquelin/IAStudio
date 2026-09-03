/**
 * How a relief heightmap is cut into chunks, and what one chunk costs in GPU memory.
 *
 * Grain is 64 rather than 128: a full-chunk fallback uploads four times less, measured in
 * `reliefChunkCost.test.ts`. Typical maps 256–1024; a 4K map would want 128 to keep draw calls down.
 */

export const RELIEF_CHUNK_TEXELS = 64

export const RELIEF_CHUNK_CANDIDATES = [64, 128] as const

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
