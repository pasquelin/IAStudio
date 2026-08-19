import { readOtiozFile } from './otiozRead'
import { writeOtiozFile } from './otiozWrite'
import { isBundleCancel, type BundleMessage, type BundleResponse } from './bundleProtocol'

/**
 * The bundle's own process — a `utilityProcess`, which is what invariant 6 asks for around a zip:
 * the archive of a montage IS the rushes. Measured on the main process: 545–860 ms of blocked loop
 * per 320 Mio written, in stalls of up to 135 ms.
 */

const running = new Map<number, AbortController>()

const reply = (response: BundleResponse): void => {
  process.parentPort.postMessage(response)
}

// The message alone, so the sentence naming the missing rush survives the boundary — `String` on
// an `Error` prefixes it, and the client wraps it in one again on the other side.
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Never throws — one process serves every export at once, so a loop that dies takes them all
// down, not just the montage that caused it.
process.parentPort.on('message', event => {
  const message: BundleMessage = event.data

  try {
    if (isBundleCancel(message)) {
      running.get(message.id)?.abort()
      return
    }

    const controller = new AbortController()
    running.set(message.id, controller)

    const watch = {
      onStep: (done: number, total: number) =>
        reply({ id: message.id, kind: 'progress', done, total }),
      signal: controller.signal,
    }

    const work = message.writes
      ? writeOtiozFile(
          message.path,
          { content: message.content, media: message.media },
          watch,
        ).then((written): BundleResponse => ({ id: message.id, kind: 'wrote', written }))
      : readOtiozFile(message.path, message.into, watch).then((contents): BundleResponse => ({
          id: message.id,
          kind: 'read',
          contents,
        }))

    work
      .then(reply, (error: unknown) =>
        reply({ id: message.id, kind: 'failed', error: messageOf(error) }),
      )
      .finally(() => running.delete(message.id))
  } catch (error) {
    running.delete(message.id)
    reply({ id: message.id, kind: 'failed', error: messageOf(error) })
  }
})
