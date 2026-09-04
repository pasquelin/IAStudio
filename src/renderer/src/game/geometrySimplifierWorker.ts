import { BufferGeometryLoader } from 'three'
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js'
import type {
  GeometrySimplifierRequest,
  GeometrySimplifierResponse,
} from './geometrySimplifierProtocol'

const modifier = new SimplifyModifier()

self.addEventListener('message', (event: MessageEvent<GeometrySimplifierRequest>) => {
  let response: GeometrySimplifierResponse
  try {
    const geometry = new BufferGeometryLoader().parse(event.data.geometry)
    const remove = Math.floor(geometry.getAttribute('position').count * event.data.ratio)
    response = {
      id: event.data.id,
      kind: 'simplified',
      geometry: (remove > 0 ? modifier.modify(geometry, remove) : geometry.clone()).toJSON(),
    }
  } catch (error) {
    response = { id: event.data.id, kind: 'failed', error: String(error) }
  }
  self.postMessage(response)
})
