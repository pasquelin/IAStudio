import { PEAKS_PER_SECOND, type Asset, type AssetType, type MediaProbe } from '@shared/domain/asset'
import type { IngestProgress, IngestStage } from '@shared/domain/media'
import { PEAKS_FOLDER, PROXIES_FOLDER } from '@shared/domain/project'
import { peaksArgs, proxyArgs, PEAKS_SAMPLE_RATE } from './ffmpeg'
import { createPeakReducer } from './peaks'
import type { ProbeOutcome } from './probe'

/**
 * What WebCodecs decodes without help. Anything else is montaged on a proxy. Both spellings of
 * each codec are listed: ffprobe reports `h264` and `av1`, the WebCodecs registry `avc1` and
 * `av01`, and a probe read through the wrong one asks for a proxy nobody needs.
 */
const DECODABLE_CODECS: readonly string[] = ['avc1', 'h264', 'vp8', 'vp9', 'av01', 'av1']

export type MediaServiceDeps = {
  /** The resolved binary, or null when there is none — see `resolveFfmpeg`. */
  ffmpeg: () => string | null
  /**
   * The signal is aborted by `cancel`: a proxy of a twenty-minute rush must stop on demand.
   * `onStdout`, when given, folds the output as it arrives instead of collecting it.
   */
  run: (
    binary: string,
    args: string[],
    signal: AbortSignal,
    onStdout?: (chunk: Uint8Array) => void,
  ) => Promise<Buffer>
  /** A missing ffprobe is not a failed import; a file ffprobe refuses is — see `ProbeOutcome`. */
  probe: (source: string, signal: AbortSignal) => Promise<ProbeOutcome>
  hash: (source: string) => Promise<string>
  /** Whether the catalogue already holds another row with the same bytes. */
  duplicateExists: (assetId: string, hash: string) => Promise<boolean>
  /** Drops the row this pick minted. What the catalogue must not keep, it must not show. */
  discard: (assetId: string) => Promise<void>
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

  // A pool, not a burst: forty rushes picked at once would be forty ffmpeg processes.
  const acquire = async (): Promise<void> => {
    if (active >= deps.concurrency()) await new Promise<void>(resolve => waiting.push(resolve))
    active += 1
  }

  const release = (): void => {
    active -= 1
    waiting.shift()?.()
  }

  return {
    ingest: async (assetId, sourcePath, kind) => {
      const controller = new AbortController()
      // Registered before queuing, so a file still waiting its turn can be cancelled too.
      running.set(assetId, controller)
      const cancelled = (): boolean => controller.signal.aborted
      const fields: Partial<Asset> = { sourcePath }
      let stage: IngestStage = 'queued'

      const advance = (next: IngestStage): void => {
        stage = next
        deps.onProgress({ assetId, stage, ratio: STAGE_RATIO[stage] })
      }

      advance('queued')
      await acquire()

      try {
        if (cancelled()) return

        advance('probe')
        const outcome = await deps.probe(sourcePath, controller.signal)
        if (cancelled()) return

        // Refused by the tool that can read every format the picker offers: the file is not
        // media, and a row saying otherwise is worse than no row at all.
        if (outcome.kind === 'unreadable') {
          stage = 'unreadable'
          return
        }

        const probe = outcome.kind === 'probed' ? outcome.probe : null
        if (probe) fields.probe = probe

        advance('hash')
        const hash = await deps.hash(sourcePath)
        fields.hash = hash
        if (cancelled()) return

        // The same bytes are already in the catalogue: the row that is there keeps its tags,
        // its proxy and its waveform, and this second pick reuses it rather than doubling it.
        if (await deps.duplicateExists(assetId, hash)) {
          stage = 'duplicate'
          return
        }
        if (cancelled()) return

        const binary = deps.ffmpeg()
        const project = deps.projectPath()
        const timed = kind === 'video' || kind === 'audio'

        if (timed && binary && project && probe) {
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
            const buckets = Math.max(1, Math.round(seconds * PEAKS_PER_SECOND))
            // Folded as ffmpeg writes it: an hour of audio is 57 MB of PCM, and holding it to
            // reduce it afterwards froze every window for the length of the reduction.
            const reducer = createPeakReducer(buckets, PEAKS_SAMPLE_RATE / PEAKS_PER_SECOND)

            await deps.run(binary, peaksArgs(sourcePath), controller.signal, chunk =>
              reducer.push(chunk),
            )
            if (cancelled()) return

            const relative = `${PEAKS_FOLDER}/${hash}.bin`
            await deps.writeFile(`${project}/${relative}`, new Uint8Array(reducer.finish().buffer))
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

        // Two outcomes leave nothing worth keeping: a file that is not media, and bytes the
        // catalogue already holds. Both drop the row this pick minted rather than write to it.
        // `failed` is not one of them — a proxy that broke after a good probe keeps its row.
        if (stage === 'duplicate' || stage === 'unreadable') {
          await deps.discard(assetId)
        } else if (stage !== 'queued') {
          // Saved whatever else happened: a proxy that failed after the probe and the hash
          // succeeded must not throw them away — there is no retry, and re-picking makes a
          // new row.
          deps.save(assetId, fields)
        }

        advance(cancelled() ? 'cancelled' : stage)
      }
    },

    cancel: assetId => {
      running.get(assetId)?.abort()
    },
  }
}
