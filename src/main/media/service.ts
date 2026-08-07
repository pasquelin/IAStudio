import type { Asset, AssetType, MediaProbe } from '@shared/domain/asset'
import type { IngestProgress, IngestStage } from '@shared/domain/media'
import { peaksArgs, proxyArgs } from './ffmpeg'
import { decodePeaks, samplesOf } from './peaks'

/**
 * What WebCodecs decodes without help. Anything else is montaged on a proxy. Both spellings of
 * each codec are listed: ffprobe reports `h264` and `av1`, the WebCodecs registry `avc1` and
 * `av01`, and a probe read through the wrong one asks for a proxy nobody needs.
 */
const DECODABLE_CODECS: readonly string[] = ['avc1', 'h264', 'vp8', 'vp9', 'av01', 'av1']

/** One peak pair per 20 ms of sound: fine enough to read a transient at any usable zoom. */
const PEAKS_PER_SECOND = 50

export type MediaServiceDeps = {
  /**
   * The resolved binary, or null when there is none — see `resolveFfmpeg`. `refresh` asks for
   * a fresh lookup: a user who installs ffmpeg while the studio runs must not have to restart.
   */
  ffmpeg: (options?: { refresh?: boolean }) => string | null
  /** The signal is aborted by `cancel`: a proxy of a twenty-minute rush must stop on demand. */
  run: (binary: string, args: string[], signal: AbortSignal) => Promise<Buffer>
  /** Null when nothing could read the file — a missing ffprobe is not a failed import. */
  probe: (source: string, signal: AbortSignal) => Promise<MediaProbe | null>
  hash: (source: string) => Promise<string>
  save: (assetId: string, fields: Partial<Asset>) => void
  writeFile: (path: string, data: Uint8Array) => Promise<void>
  onProgress: (progress: IngestProgress) => void
  projectPath: () => string | null
  /** How many ingests may run at once — `hardwareConcurrency - 2`, per CLAUDE.md § 6. */
  concurrency: () => number
}

export type MediaService = {
  /** `kind` decides what the pipeline runs: a still needs neither a proxy nor a waveform. */
  ingest: (assetId: string, sourcePath: string, kind: AssetType) => Promise<void>
  cancel: (assetId: string) => void
  available: () => boolean
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
}

export function createMediaService(deps: MediaServiceDeps): MediaService {
  const running = new Map<string, AbortController>()
  const waiting: (() => void)[] = []
  let active = 0

  /**
   * A pool, not a burst: picking forty rushes would otherwise start forty ffmpeg processes at
   * once, and each of them is happy to eat a core.
   */
  const acquire = async (): Promise<void> => {
    if (active >= deps.concurrency()) await new Promise<void>(resolve => waiting.push(resolve))
    active += 1
  }

  const release = (): void => {
    active -= 1
    waiting.shift()?.()
  }

  const report = (assetId: string, stage: IngestStage): void =>
    deps.onProgress({ assetId, stage, ratio: STAGE_RATIO[stage] })

  return {
    ingest: async (assetId, sourcePath, kind) => {
      const controller = new AbortController()
      // Registered before queuing, so a file still waiting its turn can be cancelled too.
      running.set(assetId, controller)
      const cancelled = (): boolean => controller.signal.aborted
      const fields: Partial<Asset> = { sourcePath }
      let stage: IngestStage = 'queued'

      report(assetId, 'queued')
      await acquire()

      try {
        if (cancelled()) return

        report(assetId, (stage = 'probe'))
        const probe = await deps.probe(sourcePath, controller.signal)
        if (probe) fields.probe = probe
        if (cancelled()) return

        report(assetId, (stage = 'hash'))
        fields.hash = await deps.hash(sourcePath)
        if (cancelled()) return

        const binary = deps.ffmpeg()
        const project = deps.projectPath()
        // A still has neither a proxy to stand in for it nor a waveform to draw.
        const timed = kind === 'video' || kind === 'audio'

        if (timed && binary && project && probe && needsProxy(probe)) {
          report(assetId, (stage = 'proxy'))
          const relative = `.index/proxies/${fields.hash}.mp4`
          await deps.run(binary, proxyArgs(sourcePath, `${project}/${relative}`), controller.signal)
          if (cancelled()) return
          fields.proxyPath = relative
        }

        // Without a duration there is no bucket count worth computing, and a waveform reduced
        // to one pair is a flat line that looks exactly like silence.
        if (timed && binary && project && probe?.sampleRate && probe.duration > 0) {
          report(assetId, (stage = 'peaks'))
          const pcm = await deps.run(binary, peaksArgs(sourcePath), controller.signal)
          if (cancelled()) return

          const samples = samplesOf(pcm)
          const buckets = Math.max(1, Math.round((probe.duration / 1_000_000) * PEAKS_PER_SECOND))
          const relative = `.index/peaks/${fields.hash}.bin`

          await deps.writeFile(
            `${project}/${relative}`,
            new Uint8Array(decodePeaks(samples, buckets).buffer),
          )
          fields.peaksPath = relative
        }

        stage = 'done'
      } catch {
        // An unreadable file is a normal outcome of letting users pick any file.
        stage = 'failed'
      } finally {
        release()
        running.delete(assetId)

        // Saved whatever happened: a proxy that failed after the probe and the hash succeeded
        // must not throw them away — there is no retry, and re-picking makes a new row.
        if (stage !== 'queued') deps.save(assetId, fields)
        report(assetId, cancelled() ? 'cancelled' : stage)
      }
    },

    cancel: assetId => {
      running.get(assetId)?.abort()
    },

    available: () => deps.ffmpeg({ refresh: true }) !== null,
  }
}
