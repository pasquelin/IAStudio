import type { BufferGeometryJSON } from 'three'

export type GeometrySimplifierRequest = {
  id: number
  geometry: BufferGeometryJSON
  ratio: number
}

export type GeometrySimplifierResponse =
  | { id: number; kind: 'simplified'; geometry: BufferGeometryJSON }
  | { id: number; kind: 'failed'; error: string }
