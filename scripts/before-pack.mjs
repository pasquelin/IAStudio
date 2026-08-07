/**
 * Fetches the ffmpeg of the target being packaged, right before electron-builder packs it.
 *
 * A single `pnpm dist` builds several targets — macOS ships arm64 and x64 from one run — while
 * `resources/ffmpeg/` holds one platform's binaries at a time. Left to a manual
 * `pnpm ffmpeg:fetch`, the second bundle would carry the first one's binary: signed, present,
 * and refusing to start on the machine it was built for. Worse, a clone that never ran the
 * fetch would produce a release with no encoder at all, silently.
 *
 * Hooked here rather than in `dist.sh` because this is the only place that knows which target
 * is being packed, and it runs once per target.
 */
import { fetchFfmpeg } from './fetch-ffmpeg.mjs'

/** electron-builder passes `Arch` as an enum ordinal; these are its members, in order. */
const ARCHITECTURES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal']

export default async function beforePack(context) {
  const platform = context.electronPlatformName
  const arch = ARCHITECTURES[context.arch]

  if (!arch) throw new Error(`Unknown architecture ordinal ${context.arch}`)

  // A universal macOS build merges two single-arch ones, each already packed through this hook.
  if (arch === 'universal') return

  console.log(`Fetching ffmpeg for ${platform}-${arch}`)
  await fetchFfmpeg(platform, arch)
}
