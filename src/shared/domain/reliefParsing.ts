import { isRecord, readString } from '../guards'
import type { PackedReliefChunk, ReliefSculpt } from './relief'

export function readReliefSculpt(value: unknown): ReliefSculpt | undefined {
  if (!isRecord(value) || !Array.isArray(value.chunks)) return undefined
  return { chunks: value.chunks.flatMap(readPackedChunk) }
}

export function readReliefGrain(value: unknown, fallback: number): number {
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
