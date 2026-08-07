/**
 * Where an ingest is in the pipeline the spec lays out: probe → hash → proxy → peaks. `queued`
 * comes first because the pool is bounded — a file waiting its turn must still be visible, and
 * cancellable, rather than absent from the screen until a slot frees up.
 */
export type IngestStage =
  'queued' | 'probe' | 'hash' | 'proxy' | 'peaks' | 'done' | 'cancelled' | 'failed'

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
