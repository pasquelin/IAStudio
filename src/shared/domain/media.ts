/**
 * Where an ingest is in the pipeline the spec lays out: probe → hash → proxy → peaks. `queued`
 * comes first because the pool is bounded — a file waiting its turn must still be visible, and
 * cancellable, rather than absent from the screen until a slot frees up.
 */
export type IngestStage =
  | 'queued'
  | 'probe'
  | 'hash'
  | 'proxy'
  | 'peaks'
  | 'done'
  | 'cancelled'
  | 'failed'
  /** The same bytes are already in the catalogue: the row minted for this pick was dropped. */
  | 'duplicate'
  /** ffprobe read the file and refused it — it is not media, whatever its extension says. */
  | 'unreadable'

/** Nothing more will happen to this file: the row leaves the list of what is being prepared. */
export const ENDED_STAGES: readonly IngestStage[] = ['done', 'cancelled', 'duplicate']

export function hasEnded(stage: IngestStage): boolean {
  return ENDED_STAGES.includes(stage)
}

/** Ended badly: the row stays on screen, in red, because it is the only trace the import left. */
export const FAILED_STAGES: readonly IngestStage[] = ['failed', 'unreadable']

export function hasFailed(stage: IngestStage): boolean {
  return FAILED_STAGES.includes(stage)
}

export type IngestProgress = {
  assetId: string
  stage: IngestStage
  /** 0 to 1 across the whole ingest, not within the stage. */
  ratio: number
}

/** What the interface needs to say which part of the pipeline is unavailable, and why. */
export type MediaCapabilities = {
  /** False when no ffmpeg was resolved: no proxy, no waveform — importing still works. */
  ffmpeg: boolean
}
