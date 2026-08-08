/**
 * Puts the Draco and KTX2 decoders where the renderer can be served them.
 *
 * `GLTFLoader` does not decode either format itself: it hands the compressed buffers to a
 * decoder it fetches at runtime, from a path given as a URL. three.js ships both under
 * `node_modules/three/examples/jsm/libs/`, which no bundler can reach at runtime and which the
 * renderer has no filesystem to read — so they are copied into the renderer's `public/` folder,
 * which Vite serves in development and copies beside the bundle on build. The same URL works on
 * both sides, which is what the packaged app needs.
 *
 * Never from a CDN: Electron's policy forbids it, and the studio promises that loading a model
 * never depends on the network.
 *
 * Copied on postinstall rather than committed: roughly 700 kB of wasm that belongs to three.js
 * and moves with it. `public/decoders/` is ignored by git for the same reason `resources/ffmpeg/`
 * is — a binary that a package manager can produce is not source.
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Resolved through an addon rather than through `three` itself: the package exports no
 * `./package.json`, and resolving the main entry would answer the bundled ESM build instead of
 * the folder the decoders sit in.
 */
const addons = dirname(require.resolve('three/addons/loaders/GLTFLoader.js'))

const libs = resolve(addons, '../libs')
const target = join(root, 'src/renderer/public/decoders')

/**
 * Named one by one rather than by folder: `draco/gltf/` also holds `draco_decoder.js`, a 500 kB
 * asm.js fallback for browsers without WebAssembly. Electron has WebAssembly, so it would be
 * half the weight of this folder for a path the studio can never take.
 *
 * `draco/gltf/` and not `draco/`: the loader wants the glTF-flavoured build, which decodes the
 * attribute layout a `.glb` carries. Each `.js` glue reads the `.wasm` beside it, so the pair
 * travels together and under the name the loader asks for.
 */
const files = [
  ['draco/gltf/draco_wasm_wrapper.js', 'draco/draco_wasm_wrapper.js'],
  ['draco/gltf/draco_decoder.wasm', 'draco/draco_decoder.wasm'],
  ['basis/basis_transcoder.js', 'basis/basis_transcoder.js'],
  ['basis/basis_transcoder.wasm', 'basis/basis_transcoder.wasm'],
]

rmSync(target, { recursive: true, force: true })

for (const [from, to] of files) {
  const destination = join(target, to)
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(join(libs, from), destination)
}
