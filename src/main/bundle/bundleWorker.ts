import { createWorkerDispatch } from '@main/workerDispatch'
import { readOtiozFile } from './otiozRead'
import { writeOtiozFile } from './otiozWrite'
import {
  isBundleCancel,
  type BundleCancel,
  type BundleMessage,
  type BundleResponse,
} from './bundleProtocol'

/**
 * The bundle's own process — a `utilityProcess`, which is what invariant 6 asks for around a zip:
 * the archive of a montage IS the rushes. Measured on the main process: 545–860 ms of blocked loop
 * per 320 Mio written, in stalls of up to 135 ms.
 */

const reply = (response: BundleResponse): void => {
  process.parentPort.postMessage(response)
}

// The message alone, so the sentence naming the missing rush survives the boundary — `String` on
// an `Error` prefixes it, and the client wraps it in one again on the other side.
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const isJob = (message: BundleMessage): message is Exclude<BundleMessage, BundleCancel> =>
  !isBundleCancel(message)

const dispatch = createWorkerDispatch({
  reply,
  isJob,
  run: (job, signal) => {
    const watch = {
      onStep: (done: number, total: number) => reply({ id: job.id, kind: 'progress', done, total }),
      signal,
    }

    return job.writes
      ? writeOtiozFile(job.path, { content: job.content, media: job.media }, watch).then(
          (written): BundleResponse => ({ id: job.id, kind: 'wrote', written }),
        )
      : readOtiozFile(job.path, job.into, watch).then((contents): BundleResponse => ({
          id: job.id,
          kind: 'read',
          contents,
        }))
  },
  failed: (id, error): BundleResponse => ({ id, kind: 'failed', error: messageOf(error) }),
})

process.parentPort.on('message', event => dispatch(event.data))
