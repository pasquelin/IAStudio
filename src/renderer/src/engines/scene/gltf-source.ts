import type { WebGLRenderer } from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import type { ModelSource } from './model-cache'

/**
 * Where the decoders are served from. A folder, not a file: each loader appends the names it
 * knows. `/decoders/` resolves against the page in both worlds — the dev server serves
 * `src/renderer/public/`, a build copies it beside the bundle — and never against the network,
 * which the window policy forbids and the studio promises.
 *
 * Put there by `scripts/copy-decoders.mjs` on postinstall; a checkout that skipped it loads
 * plain `.glb` files and reports a failure for compressed ones, like any unreadable file.
 */
const DRACO_PATH = '/decoders/draco/'
const KTX2_PATH = '/decoders/basis/'

/**
 * A source and the handle that shuts it down. Both decoders own Web Workers and nothing else can
 * reach them from behind the load function, while an engine is rebuilt on every panel detach —
 * so `dispose` is required, not tidy.
 */
export type GltfSource = {
  load: ModelSource
  dispose: () => void
}

/**
 * The one place a `.glb` is turned into objects. Kept apart from the engine so the cache can be
 * driven by a stub under jsdom, which decodes nothing — same reason `TextureSource` exists.
 *
 * Draco squeezes geometry, KTX2 squeezes textures, and both are ordinary in a model downloaded
 * from anywhere: without them such a file fails exactly like a corrupt one.
 *
 * The renderer arrives late on purpose. `KTX2Loader` has to ask the GPU which compressed formats
 * it can actually transcode to, and the viewport has no renderer until it is mounted — while
 * this source is built in the engine's constructor.
 */
export function createGltfSource(rendererOf: () => WebGLRenderer | null): GltfSource {
  const loader = new GLTFLoader()

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH)
  loader.setDRACOLoader(draco)

  const ktx2 = new KTX2Loader().setTranscoderPath(KTX2_PATH)
  loader.setKTX2Loader(ktx2)

  let detected = false

  return {
    load: async url => {
      // Once, and only once there is a GPU to ask: called twice, the loader would rebuild its
      // support table on every model.
      const renderer = detected ? null : rendererOf()
      if (renderer) {
        ktx2.detectSupport(renderer)
        detected = true
      }

      const gltf = await loader.loadAsync(url)
      return gltf.scene
    },
    // `KTX2Loader` counts live instances: an undisposed one makes the next engine warn about itself.
    dispose: () => {
      draco.dispose()
      ktx2.dispose()
    },
  }
}
