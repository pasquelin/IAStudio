import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { ModelSource } from './model-cache'

/**
 * The one place a `.glb` is turned into objects. Kept apart from the engine so the cache can be
 * driven by a stub under jsdom, which decodes nothing — same reason `TextureSource` exists.
 *
 * No Draco and no KTX2 yet: roughly 700 kB of wasm plus their JS glue, which have to be served
 * to the renderer — and where they are served from differs between the dev server and a
 * packaged app. The loader is built here and nowhere else, so branching them later is this
 * function and no other. Until then a compressed `.glb` fails to load like any unreadable file.
 */
export function createGltfSource(): ModelSource {
  const loader = new GLTFLoader()

  return async url => {
    const gltf = await loader.loadAsync(url)
    return gltf.scene
  }
}
