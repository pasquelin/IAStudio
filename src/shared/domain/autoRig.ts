import { rigFaultOf, type Rig } from './rig'

export type AutoRigTarget = 'humanoid' | 'generic'

export type AutoRigCapabilities = {
  target: AutoRigTarget
  skeleton: boolean
  skinWeights: boolean
  fingers: boolean
  local: boolean
}

export type AutoRigBackendDescriptor = {
  id: string
  requiresModel: boolean
  modelIds: readonly string[]
  devices: readonly AutoRigDevice[]
  experimental: boolean
  capabilities: AutoRigCapabilities
  platformSupport?: readonly AutoRigPlatformSupport[]
}

export type AutoRigDevice = 'cpu' | 'mps'
export type AutoRigAvailability = 'available' | 'unavailable' | 'untested' | 'unsupported'
export type AutoRigPlatform = 'darwin' | 'linux' | 'win32'
export type AutoRigArchitecture = 'arm64' | 'x64'
export type AutoRigPlatformSupport = {
  platform: AutoRigPlatform
  architecture: AutoRigArchitecture
  status: AutoRigAvailability
}

export function autoRigAvailabilityOf(
  backend: AutoRigBackendDescriptor,
  platform: AutoRigPlatform,
  architecture: AutoRigArchitecture,
): AutoRigAvailability {
  if (!backend.platformSupport) return 'available'
  return (
    backend.platformSupport.find(
      target => target.platform === platform && target.architecture === architecture,
    )?.status ?? 'untested'
  )
}

/** One original glTF primitive's four influences, kept separate across backend boundaries. */
export type AutoRigSkinBinding = {
  mesh: number
  primitive: number
  skinIndex: Uint16Array
  skinWeight: Float32Array
}

export type AutoRigPrimitiveTarget = {
  mesh: number
  primitive: number
  vertexCount: number
}

/** The only representation a backend hands to the studio rig runtime. */
export type AutoRigResult = {
  rig: Rig
  bindings: readonly AutoRigSkinBinding[]
  metadata: {
    backendId: string
    sourceInfluences: number
    outputInfluences: number
    fingers: boolean
  }
}

export type AutoRigResultFault =
  | 'invalid-rig'
  | 'invalid-metadata'
  | 'invalid-binding-target'
  | 'duplicate-binding-target'
  | 'invalid-binding-size'
  | 'invalid-joint-index'
  | 'invalid-weight'

export function autoRigResultFaultOf(
  result: AutoRigResult,
  expectedTargets: readonly AutoRigPrimitiveTarget[],
): AutoRigResultFault | null {
  if (rigFaultOf(result.rig.bones)) return 'invalid-rig'
  if (
    result.metadata.outputInfluences !== 4 ||
    result.metadata.sourceInfluences < result.metadata.outputInfluences ||
    result.metadata.backendId.length === 0
  )
    return 'invalid-metadata'
  if (result.bindings.length === 0) return 'invalid-binding-size'
  const expected = new Map(
    expectedTargets.map(target => [`${target.mesh}:${target.primitive}`, target.vertexCount]),
  )
  if (expected.size !== expectedTargets.length) return 'duplicate-binding-target'
  const targets = new Set<string>()
  for (const binding of result.bindings) {
    const target = `${binding.mesh}:${binding.primitive}`
    const vertexCount = expected.get(target)
    const bindingFault = autoRigBindingFaultOf(binding, vertexCount, result.rig.bones.length)
    if (bindingFault) return bindingFault
    if (targets.has(target)) return 'duplicate-binding-target'
    targets.add(target)
  }
  return targets.size === expected.size ? null : 'invalid-binding-target'
}

function autoRigBindingFaultOf(
  binding: AutoRigSkinBinding,
  vertexCount: number | undefined,
  boneCount: number,
): AutoRigResultFault | null {
  if (!Number.isInteger(binding.mesh) || binding.mesh < 0) return 'invalid-binding-target'
  if (!Number.isInteger(binding.primitive) || binding.primitive < 0 || vertexCount === undefined) {
    return 'invalid-binding-target'
  }
  if (
    binding.skinIndex.length === 0 ||
    binding.skinIndex.length !== binding.skinWeight.length ||
    binding.skinIndex.length !== vertexCount * 4
  )
    return 'invalid-binding-size'
  if (binding.skinIndex.some(index => index >= boneCount)) return 'invalid-joint-index'
  for (let vertex = 0; vertex < binding.skinWeight.length; vertex += 4) {
    const weights = binding.skinWeight.slice(vertex, vertex + 4)
    if (weights.some(weight => !Number.isFinite(weight) || weight < 0)) return 'invalid-weight'
    if (Math.abs(1 - weights.reduce((sum, weight) => sum + weight, 0)) > 1e-5)
      return 'invalid-weight'
  }
  return null
}
