import { BufferAttribute, BufferGeometry, type Object3D } from 'three'
import type {
  CompiledMeshGeometry,
  CompiledModelMesh,
  LossyOptimization,
} from '@shared/domain/gameExport'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import { createWorkerPort } from '../core/workerPort'
import { createGltfSource } from './gltfSource'
import { compiledMeshOf } from './compiledGeometry'
import LossyModelWorker from './lossyModel.worker?worker'
import type { LossyModelResponse, ModelGeometryBuffers } from './lossyModelMessage'
import { disposeTree } from './modelCache'
import { analyzeModelOptimization, type ModelOptimizationCandidate } from './worldAnalyzer'

type LossyModelPorts = {
  load: (url: string, signal: AbortSignal | undefined) => Promise<Object3D | null>
  simplify: (
    geometry: BufferGeometry,
    ratio: number,
    signal: AbortSignal | undefined,
  ) => Promise<BufferGeometry | null>
  dispose: () => void
}

export async function compileLossyModels(
  assets: readonly { id: string; url: string }[],
  options: LossyOptimization,
  signal?: AbortSignal,
  ports?: LossyModelPorts,
): Promise<ReadonlyMap<string, readonly CompiledModelMesh[]>> {
  if (!options.generateLods && options.geometrySimplification === 'off') return new Map()

  const active = ports ?? browserModelPorts()
  const compiled = new Map<string, readonly CompiledModelMesh[]>()
  try {
    for (const asset of uniqueAssets(assets)) {
      if (signal?.aborted) throw new DOMException('Model compilation aborted', 'AbortError')
      const root = await active.load(asset.url, signal)
      if (signal?.aborted) {
        if (root) disposeTree(root)
        throw new DOMException('Model compilation aborted', 'AbortError')
      }
      if (!root) continue
      try {
        const meshes: CompiledModelMesh[] = []
        const candidates = analyzeModelOptimization(root, options.generateLods)
        for (const candidate of candidates) {
          const plan = await compiledModelMesh(candidate, options, signal, active.simplify)
          if (plan) meshes.push(plan)
        }
        if (meshes.length > 0) compiled.set(asset.id, meshes)
      } finally {
        disposeTree(root)
      }
    }
    return compiled
  } finally {
    active.dispose()
  }
}

function uniqueAssets(assets: readonly { id: string; url: string }[]): readonly {
  id: string
  url: string
}[] {
  return [...new Map(assets.map(asset => [asset.id, asset])).values()]
}

async function compiledModelMesh(
  candidate: ModelOptimizationCandidate,
  options: LossyOptimization,
  signal: AbortSignal | undefined,
  simplify: LossyModelPorts['simplify'],
): Promise<CompiledModelMesh | null> {
  const ratio = DEFAULT_OPTIMIZATION_POLICY.simplificationRatios[options.geometrySimplification]
  if (options.generateLods) {
    const levels: CompiledMeshGeometry[] = []
    for (const level of DEFAULT_OPTIMIZATION_POLICY.lodSimplificationRatios) {
      const geometry = await simplify(candidate.geometry, Math.max(level, ratio), signal)
      if (!geometry) return null
      levels.push(compiledMeshOf(geometry))
      geometry.dispose()
    }
    return { meshIndex: candidate.meshIndex, lodMeshes: levels }
  }

  const geometry = await simplify(candidate.geometry, ratio, signal)
  if (!geometry) return null
  const compiled = compiledMeshOf(geometry)
  geometry.dispose()
  return { meshIndex: candidate.meshIndex, geometry: compiled }
}

function browserModelPorts(): LossyModelPorts {
  const source = createGltfSource(() => null)
  const port = createWorkerPort<BufferGeometry, LossyModelResponse>(
    () => new LossyModelWorker(),
    'lossy model',
    answer => geometryOf(answer.geometry),
  )
  return {
    load: async (url, signal) => {
      try {
        const response = await fetch(url, { signal })
        if (!response.ok) return null
        const bytes = await response.arrayBuffer()
        if (signal?.aborted) throw new DOMException('Model compilation aborted', 'AbortError')
        return source.parse ? await source.parse(bytes, url) : await source.load(url)
      } catch {
        if (signal?.aborted) throw new DOMException('Model compilation aborted', 'AbortError')
        // Missing or unsupported models remain original and are reported by the package writer.
        return null
      }
    },
    simplify: async (geometry, ratio, signal) => {
      const buffers = buffersOf(geometry)
      if (!buffers) return null
      const abort = (): void => port.dispose()
      signal?.addEventListener('abort', abort, { once: true })
      try {
        return await port.send(
          id => ({
            message: { id, geometry: buffers, ratio },
            transfer: Object.values(buffers).map(array => array.buffer),
          }),
          { signal },
        )
      } finally {
        signal?.removeEventListener('abort', abort)
      }
    },
    dispose: () => {
      port.dispose()
      source.dispose()
    },
  }
}

function buffersOf(geometry: BufferGeometry): ModelGeometryBuffers | null {
  const position = floatsOf(geometry, 'position')
  if (!position) return null
  const normal = floatsOf(geometry, 'normal')
  const uv = floatsOf(geometry, 'uv')
  const tangent = floatsOf(geometry, 'tangent')
  const color = floatsOf(geometry, 'color')
  const index = geometry.getIndex()?.array
  return {
    position,
    ...(normal ? { normal } : {}),
    ...(uv ? { uv } : {}),
    ...(tangent ? { tangent } : {}),
    ...(color ? { color } : {}),
    ...(index
      ? { index: index instanceof Uint32Array ? index.slice() : Uint32Array.from(index) }
      : {}),
  }
}

function floatsOf(geometry: BufferGeometry, name: string): Float32Array | null {
  const attribute = geometry.getAttribute(name)
  if (!(attribute instanceof BufferAttribute) || !(attribute.array instanceof Float32Array)) {
    return null
  }
  return attribute.array.slice()
}

function geometryOf(buffers: ModelGeometryBuffers): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(buffers.position, 3))
  if (buffers.normal) geometry.setAttribute('normal', new BufferAttribute(buffers.normal, 3))
  if (buffers.uv) geometry.setAttribute('uv', new BufferAttribute(buffers.uv, 2))
  if (buffers.tangent) geometry.setAttribute('tangent', new BufferAttribute(buffers.tangent, 4))
  if (buffers.color) geometry.setAttribute('color', new BufferAttribute(buffers.color, 3))
  if (buffers.index) geometry.setIndex(new BufferAttribute(buffers.index, 1))
  return geometry
}
