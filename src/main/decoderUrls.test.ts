import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { DECODER_MODULES, UNSET_DECODER_URL, withoutDecoderUrls } from './decoderUrls'

// Under `src/main` rather than `src/shared`: it reads what sits beside the repository root, and
// `src/shared` compiles for the renderer, which has no filesystem.
const require = createRequire(import.meta.url)
const loaders = dirname(require.resolve('three/addons/loaders/GLTFLoader.js'))

const sourceOf = (module: string): string => readFileSync(join(loaders, module), 'utf8')

/**
 * `decoderPaths` is what `DRACOLoader` will fetch, and `@types/three` does not declare it. Read
 * through a guard rather than asserted past the compiler: if three.js ever stops keeping them
 * there, this throws by name instead of quietly proving nothing.
 */
function decoderPathsOf(loader: DRACOLoader): Record<string, string> {
  const paths: unknown = Reflect.get(loader, 'decoderPaths')
  if (typeof paths !== 'object' || paths === null) {
    throw new Error('DRACOLoader no longer keeps its decoder paths under `decoderPaths`')
  }

  return Object.fromEntries(
    Object.entries(paths).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

describe('the decoder URLs three.js writes', () => {
  /**
   * The case this whole rewrite exists for. If three.js ever spells these differently, the
   * rewrite matches nothing and the bundler silently puts two megabytes back — so the pattern is
   * checked against the installed package rather than against a copy of what it used to say.
   */
  it('are still there to strip, in both loaders', () => {
    for (const module of DECODER_MODULES) {
      expect(withoutDecoderUrls(sourceOf(module)), `${module} names none`).not.toBe(
        sourceOf(module),
      )
    }
  })

  /**
   * The `new URL` ones only. `KTX2Loader.js` also imports `../libs/ktx-parse.module.js` and
   * `../libs/zstddec.module.js` — code the bundle needs, not assets it emits beside itself.
   */
  it('leave the modules the bundle actually needs alone', () => {
    for (const module of DECODER_MODULES) {
      const stripped = withoutDecoderUrls(sourceOf(module))

      expect(stripped).not.toMatch(/new URL\(\s*'\.\.\/libs\//)
    }

    expect(withoutDecoderUrls(sourceOf('KTX2Loader.js'))).toContain(
      "import { ZSTDDecoder } from '../libs/zstddec.module.js'",
    )
  })

  /**
   * Never a served path. `copy-decoders.mjs` keeps one Draco build where three.js names two, so a
   * plausible default would quietly hand the glTF decoder to a caller asking for the other.
   */
  it('become a value no scheme resolves, not a path the studio serves', () => {
    for (const module of DECODER_MODULES) {
      const stripped = withoutDecoderUrls(sourceOf(module))

      expect(stripped).toContain(UNSET_DECODER_URL)
      expect(stripped).not.toContain('/decoders/')
    }
  })
})

/**
 * Measured: with the plugin taken out of the renderer's list, the whole suite stays green and two
 * megabytes come back. The artefact check would see 835 738 of them — the byte-identical twins —
 * and nothing at all of the 1 063 920 that have no twin. So the wiring is asserted here, where
 * the rewrite lives, rather than left to a guard that only sees part of the damage.
 */
describe('the plugin that applies it', () => {
  /**
   * Comments stripped first: `plugins: [react() /*, strippedDecoderUrls() *\/]` still holds the
   * name, and a guard that a comment marker disarms is one a rebase disarms by accident.
   */
  it('is in the renderer’s plugin list, where the bundle is made', () => {
    const config = readFileSync(
      join(import.meta.dirname, '..', '..', 'electron.vite.config.ts'),
      'utf8',
    )
    const code = config.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    expect(code).toMatch(/plugins: \[[^\]]*strippedDecoderUrls\(\)/)
  })
})

/**
 * Whether stripping the defaults can starve a reachable path — the one question reading the code
 * cannot settle, and the only one this lot puts at risk.
 *
 * Against the REAL loaders. `gltf-source.test.ts` stands them in with classes that record what
 * they are told, so it proves the studio calls the setters and nothing about three.js honouring
 * them. What a full run would add beyond this is that a compressed model decodes — which this lot
 * does not touch, the studio having named those paths before it and after.
 *
 * What the two `toBe` prove, the loop below cannot: the suite loads the module the plugin has NOT
 * rewritten — `vitest.config.ts` carries no plugin — so the defaults here are `file://` URLs and
 * never the inert value. That line is an assertion without purchase in this environment, kept
 * because it is the one that would speak the day the suite ever runs against a built bundle.
 */
describe('what the loaders will fetch once the studio has spoken', () => {
  it('takes Draco from the served folder, never from a stripped default', () => {
    const paths = decoderPathsOf(new DRACOLoader().setDecoderPath('/decoders/draco/'))

    expect(paths['js']).toBe('/decoders/draco/draco_wasm_wrapper.js')
    expect(paths['wasm']).toBe('/decoders/draco/draco_decoder.wasm')
    for (const path of Object.values(paths)) {
      expect(path).not.toContain(UNSET_DECODER_URL)
    }
  })

  /**
   * `KTX2Loader` reads its own default on one condition only — an unset path — and the studio
   * sets it in the same expression that builds the loader.
   */
  it('reaches its own default only while nobody has set a path', () => {
    expect(new KTX2Loader().transcoderPath).toBe('')
    expect(new KTX2Loader().setTranscoderPath('/decoders/basis/').transcoderPath).toBe(
      '/decoders/basis/',
    )
  })
})

describe('the rewrite itself', () => {
  it('replaces the whole expression, not just its path', () => {
    expect(
      withoutDecoderUrls(
        "const wasm = new URL( '../libs/draco/gltf/draco_decoder.wasm', import.meta.url ).toString();",
      ),
    ).toBe(`const wasm = '${UNSET_DECODER_URL}';`)
  })

  // A URL naming anything else belongs to the module, and the studio has no business moving it.
  it('leaves a URL that does not name a decoder alone', () => {
    const other = "new URL( './worker.js', import.meta.url ).toString()"

    expect(withoutDecoderUrls(other)).toBe(other)
  })
})
