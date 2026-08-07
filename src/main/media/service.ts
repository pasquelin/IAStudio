import { PEAKS_PER_SECOND, type Asset, type MediaProbe } from '@shared/domain/asset'
import { peaksArgs, proxyArgs } from './ffmpeg'
import { decodePeaks } from './peaks'

/** What WebCodecs decodes without help. Anything else is montaged on a proxy. */
const DECODABLE_CODECS: readonly string[] = ['avc1', 'h264', 'vp8', 'vp9', 'av01']

export type IngestStage = 'probe' | 'hash' | 'proxy' | 'peaks' | 'done' | 'failed'

export type IngestProgress = {
  assetId: string
  stage: IngestStage
  /** 0 to 1 across the whole ingest, not within the stage. */
  ratio: number
}

export type MediaServiceDeps = {
  /** The resolved binary, or null when there is none — see `resolveFfmpeg`. */
  ffmpeg: () => string | null
  run: (binary: string, args: string[]) => Promise<Buffer>
  probe: (source: string) => Promise<MediaProbe>
  hash: (source: string) => Promise<string>
  save: (assetId: string, fields: Partial<Asset>) => void
  writeFile: (path: string, data: Uint8Array) => Promise<void>
  onProgress: (progress: IngestProgress) => void
  projectPath: () => string | null
}

export type MediaService = {
  ingest: (assetId: string, sourcePath: string) => Promise<void>
  cancel: (assetId: string) => void
  available: () => boolean
}

export function needsProxy(probe: MediaProbe): boolean {
  // An audio-only file has no picture to stand in for.
  if (probe.height === undefined) return false
  return !DECODABLE_CODECS.includes(probe.codec) || probe.height > 1080
}

/**
 * Probe, hash, proxy, peaks — each step reports its progress and can be cancelled between two
 * others. ffmpeg being absent shortens the run; it never fails it, because an MP4 the browser
 * decodes is still perfectly montageable.
 */
export function createMediaService(deps: MediaServiceDeps): MediaService {
  const cancelled = new Set<string>()

  const report = (assetId: string, stage: IngestStage, ratio: number): void =>
    deps.onProgress({ assetId, stage, ratio })

  return {
    ingest: async (assetId, sourcePath) => {
      cancelled.delete(assetId)
      const fields: Partial<Asset> = { sourcePath }

      try {
        report(assetId, 'probe', 0.1)
        fields.probe = await deps.probe(sourcePath)
        if (cancelled.has(assetId)) return

        report(assetId, 'hash', 0.3)
        fields.hash = await deps.hash(sourcePath)
        if (cancelled.has(assetId)) return

        const binary = deps.ffmpeg()
        const project = deps.projectPath()

        if (binary && project && needsProxy(fields.probe)) {
          report(assetId, 'proxy', 0.5)
          const relative = `.index/proxies/${fields.hash}.mp4`
          await deps.run(binary, proxyArgs(sourcePath, `${project}/${relative}`))
          if (cancelled.has(assetId)) return
          fields.proxyPath = relative
        }

        if (binary && project && fields.probe.sampleRate !== undefined) {
          report(assetId, 'peaks', 0.8)
          const pcm = await deps.run(binary, peaksArgs(sourcePath))
          if (cancelled.has(assetId)) return

          const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2))
          const buckets = Math.max(
            1,
            Math.round((fields.probe.duration / 1_000_000) * PEAKS_PER_SECOND),
          )
          const relative = `.index/peaks/${fields.hash}.bin`

          await deps.writeFile(
            `${project}/${relative}`,
            new Uint8Array(decodePeaks(samples, buckets).buffer),
          )
          fields.peaksPath = relative
        }

        deps.save(assetId, fields)
        report(assetId, 'done', 1)
      } catch {
        // An unreadable file is a normal outcome of letting users pick any file.
        report(assetId, 'failed', 1)
      }
    },

    cancel: assetId => {
      cancelled.add(assetId)
    },

    available: () => deps.ffmpeg() !== null,
  }
}
