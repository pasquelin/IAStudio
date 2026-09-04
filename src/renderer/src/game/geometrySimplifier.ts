import { BufferGeometry, BufferGeometryLoader } from 'three'
import type {
  GeometrySimplifierRequest,
  GeometrySimplifierResponse,
} from './geometrySimplifierProtocol'

export type GeometrySimplifier = {
  simplify: (geometry: BufferGeometry, ratio: number) => Promise<BufferGeometry>
  dispose: () => void
}

/** Production never runs polygon collapse on the rendering thread; Node tests use the same code inline. */
export async function createGeometrySimplifier(): Promise<GeometrySimplifier> {
  if (typeof Worker === 'undefined') return await inlineSimplifier()

  const worker = new Worker(new URL('./geometrySimplifierWorker.ts', import.meta.url), {
    type: 'module',
  })
  const waiting = new Map<
    number,
    { resolve: (geometry: BufferGeometry) => void; reject: (error: Error) => void }
  >()
  let nextId = 1
  worker.addEventListener('message', (event: MessageEvent<GeometrySimplifierResponse>) => {
    const request = waiting.get(event.data.id)
    if (!request) return
    waiting.delete(event.data.id)
    if (event.data.kind === 'failed') request.reject(new Error(event.data.error))
    else request.resolve(new BufferGeometryLoader().parse(event.data.geometry))
  })
  worker.addEventListener('error', event => {
    for (const request of waiting.values()) request.reject(new Error(event.message))
    waiting.clear()
  })

  return {
    simplify: async (geometry, ratio) =>
      await new Promise<BufferGeometry>((resolve, reject) => {
        const id = nextId
        nextId += 1
        waiting.set(id, { resolve, reject })
        const request: GeometrySimplifierRequest = {
          id,
          geometry: new BufferGeometry().copy(geometry).toJSON(),
          ratio,
        }
        worker.postMessage(request)
      }),
    dispose: () => {
      worker.terminate()
      for (const request of waiting.values()) request.reject(new Error('simplifier disposed'))
      waiting.clear()
    },
  }
}

async function inlineSimplifier(): Promise<GeometrySimplifier> {
  const { SimplifyModifier } = await import('three/addons/modifiers/SimplifyModifier.js')
  const modifier = new SimplifyModifier()
  return {
    simplify: async (geometry, ratio) => {
      const remove = Math.floor(geometry.getAttribute('position').count * ratio)
      return remove > 0 ? modifier.modify(geometry, remove) : geometry.clone()
    },
    dispose: () => {},
  }
}
