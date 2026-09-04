/// <reference lib="webworker" />
import { BufferAttribute, BufferGeometry } from 'three'
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js'
import { messageOf } from '@shared/guards'
import type {
  LossyModelRequest,
  LossyModelResponse,
  ModelGeometryBuffers,
} from './lossyModelMessage'

declare const self: DedicatedWorkerGlobalScope

const modifier = new SimplifyModifier()

self.addEventListener('message', (event: MessageEvent<LossyModelRequest>) => {
  const { id, geometry: buffers, ratio } = event.data
  try {
    self.postMessage({ id, done: false, progress: 0.1 } satisfies LossyModelResponse)
    const geometry = geometryOf(buffers)
    const vertices = geometry.getAttribute('position').count
    const reduced = modifier.modify(geometry, Math.min(vertices - 3, Math.floor(vertices * ratio)))
    geometry.dispose()
    const answer = buffersOf(reduced)
    reduced.dispose()
    self.postMessage(
      { id, done: true, ok: true, geometry: answer } satisfies LossyModelResponse,
      transferablesOf(answer),
    )
  } catch (error) {
    self.postMessage({
      id,
      done: true,
      ok: false,
      error: messageOf(error),
    } satisfies LossyModelResponse)
  }
})

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

function buffersOf(geometry: BufferGeometry): ModelGeometryBuffers {
  const position = geometry.getAttribute('position').array
  if (!(position instanceof Float32Array)) throw new Error('simplified positions are not floats')
  const normal = floatsOf(geometry, 'normal')
  const uv = floatsOf(geometry, 'uv')
  const tangent = floatsOf(geometry, 'tangent')
  const color = floatsOf(geometry, 'color')
  const result: ModelGeometryBuffers = {
    position,
    ...(normal ? { normal } : {}),
    ...(uv ? { uv } : {}),
    ...(tangent ? { tangent } : {}),
    ...(color ? { color } : {}),
  }
  const index = geometry.getIndex()?.array
  if (index) result.index = index instanceof Uint32Array ? index : Uint32Array.from(index)
  return result
}

function floatsOf(geometry: BufferGeometry, name: string): Float32Array | null {
  const array = geometry.getAttribute(name)?.array
  return array instanceof Float32Array ? array : null
}

function transferablesOf(geometry: ModelGeometryBuffers): Transferable[] {
  return Object.values(geometry).map(array => array.buffer)
}
