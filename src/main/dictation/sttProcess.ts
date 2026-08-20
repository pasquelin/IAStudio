import { openForkedWorker } from '@main/forkedWorker'
import { createSttClient, type SttClient, type SttListeners } from './sttClient'
import type { SttMessage, SttResponse } from './sttProtocol'

/** Forks the recognition worker. Who keeps it, and for how long, is `session.ts`'s business. */
export function openSttProcess(listeners: SttListeners): SttClient {
  return createSttClient(
    openForkedWorker<SttMessage, SttResponse>({
      entry: new URL('./sttWorker.js', import.meta.url),
      processName: 'the recognition process',
    }),
    listeners,
  )
}
