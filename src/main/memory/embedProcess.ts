import { openForkedWorker } from '@main/forkedWorker'
import { createEmbedClient, type EmbedClient } from './embedClient'
import type { EmbedRequest, EmbedResponse } from './embedProtocol'

/**
 * Forks the embedding process. Who keeps it is `embedder.ts`'s business — `onExit` is what tells
 * it the fork is gone, without which it would hold a dead client and reject every later call.
 */
export function openEmbedProcess(onExit: () => void): EmbedClient {
  return createEmbedClient(
    openForkedWorker<EmbedRequest, EmbedResponse>({
      entry: new URL('./embedWorker.js', import.meta.url),
      processName: 'the embedding process',
      onExit,
    }),
  )
}
