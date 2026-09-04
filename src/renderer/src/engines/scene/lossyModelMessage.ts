export type ModelGeometryBuffers = {
  position: Float32Array
  normal?: Float32Array
  uv?: Float32Array
  tangent?: Float32Array
  color?: Float32Array
  index?: Uint32Array
}

export type LossyModelRequest = {
  id: number
  geometry: ModelGeometryBuffers
  ratio: number
}

export type LossyModelResponse =
  | { id: number; done: false; progress: number }
  | { id: number; done: true; ok: true; geometry: ModelGeometryBuffers }
  | { id: number; done: true; ok: false; error: string }
