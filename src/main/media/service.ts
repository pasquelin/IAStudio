import { basename } from 'node:path'
import { PEAKS_PER_SECOND, type Asset, type AssetType, type MediaProbe } from '@shared/domain/asset'
import type { IngestProgress, IngestStage } from '@shared/domain/media'
import { PEAKS_FOLDER, POSTERS_FOLDER, PROXIES_FOLDER } from '@shared/domain/project'
import { peaksArgs, posterArgs, posterOffset, proxyArgs, PEAKS_SAMPLE_RATE } from './ffmpeg'
import type { PeaksRun } from './peaks-client'
import type { ProbeOutcome } from './probe'
import type { ActivityReport } from '@main/project/activity-log'

/**
 * What WebCodecs decodes without help. Anything else is montaged on a proxy. Both spellings of
 * each codec are listed: ffprobe reports `h264` and `av1`, the WebCodecs registry `avc1` and
 * `av01`, and a probe read through the wrong one asks for a proxy nobody needs.
 */
const DECODABLE_CODECS: readonly string[] = ['avc1', 'h264', 'vp8', 'vp9', 'av01', 'av1']

export type MediaServiceDeps = {
  /** The resolved binary, or null when there is none — see `resolveFfmpeg`. */
  ffmpeg: () => string | null
  /** The signal is aborted by `cancel`: a proxy of a twenty-minute rush must stop on demand. */
  run: (binary: string, args: string[], signal: AbortSignal) => Promise<Buffer>
  /** A missing ffprobe is not a failed import; a file ffprobe refuses is — see `ProbeOutcome`. */
  probe: (source: string, signal: AbortSignal) => Promise<ProbeOutcome>
  hash: (source: string) => Promise<string>
  /** Reduces a source to a waveform off this process entirely — see `peaks-process`. */
  computePeaks: (run: PeaksRun) => Promise<Float32Array>
  /** Whether the catalogue already holds another row with the same bytes. */
  duplicateExists: (assetId: string, hash: string) => Promise<boolean>
  /** Drops the row this pick minted. What the catalogue must not keep, it must not show. */
  discard: (assetId: string) => Promise<void>
  save: (assetId: string, fields: Partial<Asset>) => void
  writeFile: (path: string, data: Uint8Array) => Promise<void>
  onProgress: (progress: IngestProgress) => void
  /** Where an import says what became of it, once the bar that showed it is gone. */
  record: (report: ActivityReport) => void
  projectPath: () => string | null
  /** How many ingests may run at once — `hardwareConcurrency - 2`, per CLAUDE.md § 6. */
  concurrency: () => number
}

export type MediaService = {
  /** `kind` decides what the pipeline runs: a still needs neither a proxy nor a waveform. */
  ingest: (assetId: string, sourcePath: string, kind: AssetType) => Promise<void>
  cancel: (assetId: string) => void
}

export function needsProxy(probe: MediaProbe): boolean {
  // An audio-only file has no picture to stand in for.
  if (probe.height === undefined) return false
  return !DECODABLE_CODECS.includes(probe.codec) || probe.height > 1080
}

/** How far along the whole ingest each stage is — announced when the stage starts. */
const STAGE_RATIO: Record<IngestStage, number> = {
  queued: 0,
  probe: 0.1,
  hash: 0.3,
  proxy: 0.5,
  peaks: 0.8,
  done: 1,
  cancelled: 1,
  failed: 1,
  duplicate: 1,
  unreadable: 1,
}

export function createMediaService(deps: MediaServiceDeps): MediaService {
  const running = new Map<string, AbortController>()
  const waiting: (() => void)[] = []
  let active = 0
  /**
   * Hashes being ingested right now. The catalogue cannot answer for them: a row only gains its
   * hash once its ingest ends, so two picks of the same bytes in one batch would both find
   * nothing — and then write the same proxy file from two ffmpeg processes at once.
   */
  const claimed = new Set<string>()

  // A pool, not a burst: forty rushes picked at once would be forty ffmpeg processes.
  const acquire = async (): Promise<void> => {
    if (active >= deps.concurrency()) await new Promise<void>(resolve => waiting.push(resolve))
    active += 1
  }

  const release = (): void => {
    active -= 1
    waiting.shift()?.()
  }

  /**
   * What an import leaves behind once its progress row is gone.
   *
   * The file name only, never its path: what a source sits on the disk is this process's
   * business, the same rule `withoutSourcePath` states for an asset crossing the boundary.
   *
   * Silent on a cancellation and on a duplicate: the user did the first, and the second is not
   * a problem — the bytes are already in the project.
   */
  const journal = (sourcePath: string, outcome: IngestStage): void => {
    const name = basename(sourcePath)

    if (outcome === 'done') {
      deps.record({
        level: 'info',
        topic: 'import',
        messageKey: 'activity.imported',
        params: { name },
      })
      return
    }

    if (outcome === 'unreadable' || outcome === 'failed') {
      deps.record({
        level: 'error',
        topic: 'import',
        messageKey:
          outcome === 'unreadable' ? 'activity.importUnreadable' : 'activity.importFailed',
        params: { name },
      })
    }
  }

  return {
    ingest: async (assetId, sourcePath, kind) => {
      const controller = new AbortController()
      // Registered before queuing, so a file still waiting its turn can be cancelled too.
      running.set(assetId, controller)
      const cancelled = (): boolean => controller.signal.aborted
      const fields: Partial<Asset> = { sourcePath }
      let stage: IngestStage = 'queued'
      /** The hash this ingest claimed, to be released whatever happens to it. */
      let mine: string | null = null

      const advance = (next: IngestStage): void => {
        stage = next
        deps.onProgress({ assetId, stage, ratio: STAGE_RATIO[stage] })
      }

      advance('queued')
      await acquire()

      try {
        if (cancelled()) return

        // ffprobe reads media, and a model is not media: asked about a `.glb` it answers
        // "unreadable", which discards the row that was just minted — a valid file vanishing
        // from the browser a second after it appeared. The hash below still runs: it is what
        // catches a duplicate and what a relink is found by, and it reads any bytes at all.
        const probed = kind !== 'mesh'

        if (probed) {
          advance('probe')
          const outcome = await deps.probe(sourcePath, controller.signal)
          if (cancelled()) return

          // Refused by the tool that can read every format the picker offers: the file is not
          // media, and a row saying otherwise is worse than no row at all.
          if (outcome.kind === 'unreadable') {
            stage = 'unreadable'
            return
          }

          if (outcome.kind === 'probed') fields.probe = outcome.probe
        }

        const probe = fields.probe ?? null

        advance('hash')
        const hash = await deps.hash(sourcePath)
        fields.hash = hash
        if (cancelled()) return

        // Claimed before the catalogue is asked, and without an await in between: the question
        // and the answer must not be separated, or two picks of the same bytes both hear "no".
        if (claimed.has(hash)) {
          stage = 'duplicate'
          return
        }
        claimed.add(hash)
        mine = hash

        // The row already in the catalogue keeps its tags, its proxy and its waveform, and this
        // second pick reuses it rather than doubling it.
        if (await deps.duplicateExists(assetId, hash)) {
          stage = 'duplicate'
          return
        }
        if (cancelled()) return

        const binary = deps.ffmpeg()
        const project = deps.projectPath()
        const timed = kind === 'video' || kind === 'audio'

        if (timed && binary && project && probe) {
          // Under the proxy's own stage rather than one of its own: a keyframe grab is a tenth
          // of a second, and a stage of its own would cost an ingest state, its label in two
          // bundles and the guards that hold them, for a bar nobody would see move.
          //
          // Swallowed on failure, like the still a download brings beside a mesh: a rush whose
          // first keyframe ffmpeg refuses is still a perfectly good import.
          if (kind === 'video') {
            const relative = `${POSTERS_FOLDER}/${assetId}.jpg`
            const args = posterArgs(
              sourcePath,
              `${project}/${relative}`,
              posterOffset(probe.duration),
            )
            try {
              await deps.run(binary, args, controller.signal)
              fields.posterPath = relative
            } catch {
              // A grid falls back to the kind's own glyph, which is what it showed before.
            }
            if (cancelled()) return
          }

          if (needsProxy(probe)) {
            advance('proxy')
            const relative = `${PROXIES_FOLDER}/${hash}.mp4`
            const destination = `${project}/${relative}`
            await deps.run(binary, proxyArgs(sourcePath, destination), controller.signal)
            if (cancelled()) return
            fields.proxyPath = relative
          }

          // Without a duration there is no bucket count worth computing, and a waveform
          // reduced to one pair is a flat line that looks exactly like silence.
          if (probe.sampleRate && probe.duration > 0) {
            advance('peaks')

            const seconds = probe.duration / 1_000_000
            // ffmpeg and the reduction both run off this process: an hour of audio is 57 MB of
            // PCM, and folding it here froze every window for the length of the fold.
            const peaks = await deps.computePeaks({
              binary,
              args: peaksArgs(sourcePath),
              buckets: Math.max(1, Math.round(seconds * PEAKS_PER_SECOND)),
              samplesPerBucket: PEAKS_SAMPLE_RATE / PEAKS_PER_SECOND,
              signal: controller.signal,
            })
            if (cancelled()) return

            const relative = `${PEAKS_FOLDER}/${hash}.bin`
            await deps.writeFile(`${project}/${relative}`, new Uint8Array(peaks.buffer))
            fields.peaksPath = relative
          }
        }

        stage = 'done'
      } catch {
        // An unreadable file is a normal outcome of letting users pick any file.
        stage = 'failed'
      } finally {
        release()
        running.delete(assetId)
        if (mine) claimed.delete(mine)

        // Two outcomes leave nothing worth keeping: a file that is not media, and bytes the
        // catalogue already holds. Both drop the row this pick minted rather than write to it.
        // `failed` is not one of them — a proxy that broke after a good probe keeps its row.
        if (stage === 'duplicate' || stage === 'unreadable') {
          // Swallowed: this runs in a `finally`, and the project may have been closed while the
          // file was being read — a throw here would escape the ingest nobody is awaiting.
          await deps.discard(assetId).catch(() => {})
        } else if (stage !== 'queued') {
          // Saved whatever else happened: a proxy that failed after the probe and the hash
          // succeeded must not throw them away — there is no retry, and re-picking makes a
          // new row.
          deps.save(assetId, fields)
        }

        const outcome = cancelled() ? 'cancelled' : stage
        advance(outcome)
        journal(sourcePath, outcome)
      }
    },

    cancel: assetId => {
      running.get(assetId)?.abort()
    },
  }
}
