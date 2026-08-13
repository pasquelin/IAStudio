import { Mesh, type Material, type Texture, type WebGLRenderer } from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { isRecord } from '@shared/guards'
import { reportFailure } from '@/services/diagnostics'
import type { ModelSource } from './model-cache'
import { texturesOf } from './scene-stats'

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
      // Carried on the root rather than returned beside it: `Object3D.animations` is where three
      // itself keeps them, and the cache hands one object back. Dropping them here is what left
      // every model Scenario animates standing still, with nothing said.
      gltf.scene.animations = gltf.animations

      const { missing, declared } = unresolvedTextures(gltf)
      // A count, not a sentence: the scope carries the translated line the user reads, and this
      // detail rides beside it exactly as an SDK message would.
      if (missing > 0) reportFailure('scene.texture', url, new Error(`${missing}/${declared}`))

      return gltf.scene
    },
    // `KTX2Loader` counts live instances: an undisposed one makes the next engine warn about itself.
    dispose: () => {
      draco.dispose()
      ktx2.dispose()
    },
  }
}

/**
 * The textures the file asks the scene's materials to wear, against the ones they got.
 *
 * `GLTFLoader` resolves a texture it could not read to `null` and carries on. The model then
 * lands whole, white, and SILENT — which is exactly how a window policy refusing the loader its
 * own blob went unnoticed until the pixels were measured. Counted so the studio can say it.
 *
 * READ, never asked for: `parser.getDependency('texture', i)` LOADS an index the parse never
 * wanted — a texture no material references would be decoded here, on the UI thread, for a
 * picture nothing will show and nothing will dispose. Both sides are compared as they stand.
 *
 * Only the materials that reached the scene are judged, and only the slots this build can read:
 * an unknown extension is a texture left uncounted, never a failure invented.
 */
function unresolvedTextures(gltf: GLTF): { missing: number; declared: number } {
  const { parser } = gltf
  const wanted = new Set<number>()
  const attached = new Set<Texture>()

  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return

    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      const index = parser.associations.get(material)?.materials
      if (index !== undefined) collectWantedTextures(materialDef(parser.json, index), wanted)
      for (const texture of texturesOf(material)) attached.add(texture)
    }
  })

  return { missing: Math.max(0, wanted.size - attached.size), declared: wanted.size }
}

/** `parser.json` is typed `any` by three, so it is read as data and never trusted for a shape. */
function materialDef(json: unknown, index: number): unknown {
  const materials = isRecord(json) ? json.materials : undefined
  return Array.isArray(materials) ? materials[index] : undefined
}

/**
 * Every texture slot a material definition fills, extensions included: glTF spells them all
 * `…Texture: { index }`, whichever specification added them — so walking for that shape covers
 * what a hand-written list of five names would have missed.
 */
function collectWantedTextures(def: unknown, into: Set<number>): void {
  if (!isRecord(def)) return

  for (const [key, value] of Object.entries(def)) {
    if (!isRecord(value)) continue

    if (key.endsWith('Texture') && typeof value.index === 'number') into.add(value.index)
    else collectWantedTextures(value, into)
  }
}
