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
 * is being packed, and it runs once per target. Targets are packed one after another —
 * `concurrency.jobs: 1` is declared in `electron-builder.yml` for that reason — so they never
 * race over the folder.
 */
import { Arch } from 'electron-builder'
import { fetchFfmpeg } from './fetch-ffmpeg.mjs'

export default async function beforePack(context) {
  const platform = context.electronPlatformName
  // `context.arch` is an `Arch` ordinal; the enum names itself rather than a table to keep.
  const arch = Arch[context.arch]

  if (!arch) throw new Error(`Unknown architecture ordinal ${context.arch}`)

  // A universal macOS build merges two single-arch ones, each already packed through this hook.
  if (arch === 'universal') return

  console.log(`Fetching ffmpeg for ${platform}-${arch}`)
  await fetchFfmpeg(platform, arch)
}
