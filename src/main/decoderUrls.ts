/**
 * Keeps three.js's Draco and KTX2 decoders out of the renderer bundle.
 *
 * `DRACOLoader.js` and `KTX2Loader.js` hold `new URL('../libs/…', import.meta.url)` at module
 * scope — seven between them. A bundler resolves those at build time and emits every file they
 * name, fetched or not. This studio never fetches them: `gltf-source.ts` calls `setDecoderPath`
 * and `setTranscoderPath`, so the loaders read the curated copies `copy-decoders.mjs` puts under
 * `public/decoders/`, and three.js's own defaults are dead the moment the studio starts.
 *
 * Measured on 2026-08-13: 1 899 658 bytes emitted and never fetched, on all three platforms.
 *
 * Rewritten to a value nothing can resolve, never to a served path. This removes an emission; it
 * does not configure anything. A plausible `/decoders/…` default would be a third truth beside
 * `copy-decoders.mjs` and `gltf-source.ts` — and a wrong one, since three.js names two different
 * Draco builds where the served folder keeps one.
 *
 * Under `src/main` rather than `src/shared`: it belongs to the build rather than to a process,
 * and `src/shared` compiles into the renderer, which has no use for it.
 */

/** What a removed default becomes: no scheme resolves it, so an accidental use fails by name. */
export const UNSET_DECODER_URL = 'provider:decoder-path-unset'

/** The two three.js modules that name their decoders by URL. */
export const DECODER_MODULES = ['DRACOLoader.js', 'KTX2Loader.js']

const LIBS_URL = /new URL\(\s*'\.\.\/libs\/[^']+'\s*,\s*import\.meta\.url\s*\)\.toString\(\)/g

/**
 * Strips every decoder URL a three.js loader names. Returns the source unchanged when it holds
 * none, which is how a caller learns the pattern has moved rather than silently doing nothing.
 */
export function withoutDecoderUrls(source: string): string {
  return source.replace(LIBS_URL, `'${UNSET_DECODER_URL}'`)
}
