import { openForkedWorker } from '@main/forkedWorker'
import { createBundleClient, type BundleClient } from './bundleClient'
import type { BundleMessage, BundleResponse } from './bundleProtocol'

/** Forks the bundle worker. Who keeps it, and for how long, is `services.ts`'s business. */
export function openBundleProcess(onExit: () => void = () => {}): BundleClient {
  return createBundleClient(
    openForkedWorker<BundleMessage, BundleResponse>({
      entry: new URL('./bundleWorker.js', import.meta.url),
      processName: 'bundle process',
      onExit,
    }),
  )
}
