import { openForkedWorker } from '@main/forkedWorker'
import { createPeaksClient, type PeaksClient } from './peaksClient'
import type { PeaksMessage, PeaksResponse } from './peaksProtocol'

/** Forks the waveform worker. Who keeps it, and for how long, is `services.ts`'s business. */
export function openPeaksProcess(onExit: () => void = () => {}): PeaksClient {
  return createPeaksClient(
    openForkedWorker<PeaksMessage, PeaksResponse>({
      entry: new URL('./peaksWorker.js', import.meta.url),
      processName: 'waveform process',
      onExit,
    }),
  )
}
