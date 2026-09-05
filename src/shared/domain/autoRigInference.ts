export type AutoRigInferencePrimitive = {
  mesh: number
  primitive: number
  vertexOffset: number
  vertexCount: number
}

export type AutoRigInferenceOptions = {
  /** Keep the predicted finger chains, or merge their skinning into the hands. */
  fingers: 'detailed' | 'simplified'
  /** Remove mutually exclusive influences and retain the four strongest weights. */
  weightPostProcessing: boolean
}

export const DEFAULT_AUTO_RIG_OPTIONS: AutoRigInferenceOptions = {
  fingers: 'simplified',
  weightPostProcessing: true,
}

export type AutoRigInferenceRequest = {
  id: string
  backendId: string
  positions: Float32Array
  triangles: Uint32Array
  primitives: readonly AutoRigInferencePrimitive[]
  options: AutoRigInferenceOptions
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

export const AUTO_RIG_PROGRESS_PHASES: readonly AutoRigProgressPhase[] = [
  'prepare',
  'load',
  'analyse',
  'skeleton',
  'pose',
  'skinning',
  'apply',
]

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

export const AUTO_RIG_PRODUCT_ERRORS: readonly AutoRigProductError[] = [
  'MODEL_NOT_INSTALLED',
  'MODEL_INVALID',
  'ENGINE_UNAVAILABLE',
  'UNSUPPORTED_PLATFORM',
  'INVALID_MESH',
  'NOT_HUMANOID',
  'INFERENCE_FAILED',
  'OUT_OF_MEMORY',
  'CANCELLED',
]
