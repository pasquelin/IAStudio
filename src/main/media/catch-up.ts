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

/** How many rows a page of the catalogue holds — its own default, stated rather than inherited. */
export const CATCH_UP_PAGE = 200

export type CatchUpDeps = {
  /**
   * One page of the timed assets the project holds, oldest-first order left to the catalogue.
   *
   * Paged rather than asked whole: a search with no limit answers its own default of 200, so a
   * project holding more takes than that would catch up the newest 200 and never reach the
   * rest — they gain no hash, the same window comes back on every open, and nothing else would
   * ever go looking for them.
   */
  list: (offset: number, limit: number) => Promise<Asset[]>
  /** Absolute path of an asset's own file, or null when the catalogue points at nothing. */
  fileOf: (asset: Asset) => string | null
  /** `null` when ffprobe is missing or refuses the file. */
  probeFile: (path: string) => Promise<MediaProbe | null>
  /** Awaited: `derive` reads the row back, and a stale read drops what was just written. */
  save: (assetId: string, fields: Partial<Asset>) => Promise<void>
  derive: (request: DeriveRequest) => Promise<void>
  /**
   * Whether the project this run started on is still the one in front.
   *
   * Checked between takes because `derive` resolves the project folder when it RUNS: a run left
   * going after another project opened wrote one project's stills, proxies and waveforms into
   * the other, under ids its catalogue has never heard of.
   */
  stillOpen: () => boolean
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
  let done = 0

  for (let offset = 0; ; offset += CATCH_UP_PAGE) {
    const page = await deps.list(offset, CATCH_UP_PAGE)

    for (const asset of page.filter(needsDeriving)) {
      if (!deps.stillOpen()) return done

      const path = deps.fileOf(asset)
      if (!path) continue

      const probe = asset.probe ?? (await deps.probeFile(path))
      // Nothing to derive from, and nothing to write down: without a length there is no bucket
      // count for a waveform and no offset for a still. Left as it is, tried again next time.
      if (!probe) continue
      // Awaited, and before the derive that follows it: both read the row and write it back,
      // and a probe still in flight would commit a copy taken before the derive landed —
      // dropping the very hash that keeps this take from being caught up again for ever.
      if (!asset.probe) await deps.save(asset.id, { probe })

      await deps.derive({
        assetId: asset.id,
        path,
        kind: asset.type,
        probe,
        // A generation came down with the library's own still, which is a picture of the take
        // rather than a frame of it. Only a row that has none gets one grabbed.
        poster: !asset.posterPath,
        // Maintenance, not an import: these rows would read as files the user never picked.
        announce: false,
      })
      done += 1
    }

    // A short page is the last one. Filtering happens after, so a page of rows that all hold a
    // hash is still a page — the walk stops on what the catalogue returned, never on the count
    // of what was worth doing.
    if (page.length < CATCH_UP_PAGE) return done
  }
}
