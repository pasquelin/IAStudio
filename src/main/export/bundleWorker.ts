import { writeOtiozFile } from './otiozFile'
import { isBundleCancel, type BundleMessage, type BundleResponse } from './bundleProtocol'

/**
 * The bundle's own process — a `utilityProcess`, which is what invariant 6 asks for around a zip:
 * the archive of a montage IS the rushes, and it was assembled on the process that owns the
 * windows. Measured there: 545–860 ms of blocked loop per 320 Mio, in stalls of up to 135 ms.
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

    writeOtiozFile(
      message.path,
      { content: message.content, media: message.media },
      {
        onStep: (done, total) => reply({ id: message.id, kind: 'progress', done, total }),
        signal: controller.signal,
      },
    )
      .then(
        written => reply({ id: message.id, kind: 'settled', written }),
        (error: unknown) => reply({ id: message.id, kind: 'failed', error: messageOf(error) }),
      )
      .finally(() => running.delete(message.id))
  } catch (error) {
    running.delete(message.id)
    reply({ id: message.id, kind: 'failed', error: messageOf(error) })
  }
})
