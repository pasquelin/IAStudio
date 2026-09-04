import {
  BufferAttribute,
  BufferGeometry,
  LOD,
  Mesh,
  PropertyBinding,
  SkinnedMesh,
  type Object3D,
} from 'three'
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

type LossyModelPorts = {
  load: (url: string) => Promise<Object3D | null>
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
      const root = await active.load(asset.url)
      if (!root) continue
      try {
        const meshes: CompiledModelMesh[] = []
        let meshIndex = 0
        const candidates: { meshIndex: number; geometry: BufferGeometry }[] = []
        const animated = animatedNodeNames(root)
        root.traverse(object => {
          if (!(object instanceof Mesh)) return
          const index = meshIndex
          meshIndex += 1
          if (canSimplify(object, options.generateLods, animated)) {
            candidates.push({ meshIndex: index, geometry: object.geometry })
          }
        })
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
  candidate: { meshIndex: number; geometry: BufferGeometry },
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

function canSimplify(mesh: Mesh, generateLods: boolean, animated: ReadonlySet<string>): boolean {
  const attributes = Object.keys(mesh.geometry.attributes)
  const color = mesh.geometry.getAttribute('color')
  return (
    !(mesh instanceof SkinnedMesh) &&
    !animated.has(mesh.name) &&
    (!generateLods || !hasLodAncestor(mesh)) &&
    Object.keys(mesh.geometry.morphAttributes).length === 0 &&
    !Array.isArray(mesh.material) &&
    attributes.every(attribute => SIMPLIFIED_MODEL_ATTRIBUTES.has(attribute)) &&
    (!color || color.itemSize === 3) &&
    mesh.geometry.drawRange.start === 0 &&
    mesh.geometry.drawRange.count === Infinity &&
    mesh.geometry.getAttribute('position')?.count > 3
  )
}

const SIMPLIFIED_MODEL_ATTRIBUTES = new Set(['position', 'normal', 'uv', 'tangent', 'color'])

function hasLodAncestor(mesh: Mesh): boolean {
  let parent = mesh.parent
  while (parent) {
    if (parent instanceof LOD) return true
    parent = parent.parent
  }
  return false
}

function animatedNodeNames(root: Object3D): ReadonlySet<string> {
  const names = new Set<string>()
  for (const clip of root.animations) {
    for (const track of clip.tracks) {
      try {
        names.add(PropertyBinding.parseTrackName(track.name).nodeName)
      } catch {
        // An unreadable track will remain attached to geometry that this compiler leaves exact.
        return new Set(namesIn(root))
      }
    }
  }
  return names
}

function namesIn(root: Object3D): readonly string[] {
  const names: string[] = []
  root.traverse(object => names.push(object.name))
  return names
}

function browserModelPorts(): LossyModelPorts {
  const source = createGltfSource(() => null)
  const port = createWorkerPort<BufferGeometry, LossyModelResponse>(
    () => new LossyModelWorker(),
    'lossy model',
    answer => geometryOf(answer.geometry),
  )
  return {
    load: async url => {
      try {
        return await source.load(url)
      } catch {
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
