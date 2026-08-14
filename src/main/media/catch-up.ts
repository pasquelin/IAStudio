import type { Asset, MediaProbe } from '@shared/domain/asset'
import type { DeriveRequest } from './service'

/**
 * Whether a take in the catalogue never met the pipeline that derives what a montage reads.
 *
 * `hash` is the marker, and it is the right one because BOTH ways in write it — a picked file
 * through `ingest`, a generation through `derive`. A row without one has been through neither,
 * which for a generation was every row until the pipeline learnt to run on downloads.
 *
 * Reading `peaksPath` instead would never settle: a silent rush legitimately has no waveform,
 * so it would be picked up again on every project opened, for ever.
 */
export function needsDeriving(asset: Asset): boolean {
  const timed = asset.type === 'video' || asset.type === 'audio'
  return timed && asset.location === 'local' && !asset.hash && Boolean(asset.path)
}

export type CatchUpDeps = {
  /** Every timed asset the open project holds. Filtered here, not in SQL — see `needsDeriving`. */
  list: () => Promise<Asset[]>
  /** Absolute path of an asset's own file, or null when the catalogue points at nothing. */
  fileOf: (asset: Asset) => string | null
  /** `null` when ffprobe is missing or refuses the file. */
  probeFile: (path: string) => Promise<MediaProbe | null>
  save: (assetId: string, fields: Partial<Asset>) => void
  derive: (request: DeriveRequest) => Promise<void>
}

/**
 * Brings the takes a project already holds up to what a montage now expects of them: a length,
 * a still, a waveform, a proxy.
 *
 * Every one of these arrived before the pipeline ran on downloads, so a project opened after
 * the fix would otherwise show exactly what it showed before it — grey tiles, five-second
 * clips, flat rectangles where a waveform belongs. A correction nobody's own files benefit
 * from is a correction nobody believes.
 *
 * One at a time on purpose. This is background work behind a project that has just opened, and
 * a burst of ffprobes would compete with the import the user may be starting in the same
 * second — `derive` bounds its own ffmpeg, `probeFile` bounds nothing.
 */
export async function catchUpMedia(deps: CatchUpDeps): Promise<number> {
  const pending = (await deps.list()).filter(needsDeriving)
  let done = 0

  for (const asset of pending) {
    const path = deps.fileOf(asset)
    if (!path) continue

    const probe = asset.probe ?? (await deps.probeFile(path))
    // Nothing to derive from, and nothing to write down: without a length there is no bucket
    // count for a waveform and no offset for a still. Left as it is, and tried again next time.
    if (!probe) continue
    if (!asset.probe) deps.save(asset.id, { probe })

    await deps.derive({
      assetId: asset.id,
      path,
      kind: asset.type,
      probe,
      // A generation came down with the library's own still, which is a picture of the take
      // rather than a frame of it. Only a row that has none gets one grabbed.
      poster: !asset.posterPath,
    })
    done += 1
  }

  return done
}
