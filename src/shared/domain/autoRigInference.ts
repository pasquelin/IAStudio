export type AutoRigInferencePrimitive = {
  mesh: number
  primitive: number
  vertexOffset: number
  vertexCount: number
}
export type AutoRigInferenceRequest = {
  id: string
  backendId: string
  positions: Float32Array
  triangles: Uint32Array
  primitives: readonly AutoRigInferencePrimitive[]
}

export type AutoRigInferenceResult = {
  jointNames: readonly string[]
  parents: Int16Array
  joints: Float32Array
  tails: Float32Array
  weights: Float32Array
  sourceInfluences: number
  modelToInput: Float32Array
  inputToModel: Float32Array
  primitives: readonly AutoRigInferencePrimitive[]
  device: string
  loadMs: number | null
  inferenceMs: number | null
  peakRssBytes: number | null
}

export type AutoRigProgressPhase =
  'prepare' | 'load' | 'analyse' | 'skeleton' | 'pose' | 'skinning' | 'apply'

export type AutoRigProductError =
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_INVALID'
  | 'ENGINE_UNAVAILABLE'
  | 'UNSUPPORTED_PLATFORM'
  | 'INVALID_MESH'
  | 'NOT_HUMANOID'
  | 'INFERENCE_FAILED'
  | 'OUT_OF_MEMORY'
  | 'CANCELLED'
