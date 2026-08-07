import { createPeakReducer } from './peaks'
import { runProcess } from './runner'
import { isCancel, type PeaksMessage, type PeaksResponse } from './peaks-protocol'

/**
 * The waveform's own process. Everything here is plumbing — the reducer and the runner are
 * tested on their own, and this file owns nothing but the message loop and the abort table.
 *
 * A `utilityProcess`, which is what CLAUDE.md § 6 asks for around ffmpeg: the reduction of an
 * hour of PCM measured 129 ms on the main thread, and every window of the studio waited it out.
 */

const running = new Map<number, AbortController>()

const reply = (response: PeaksResponse): void => {
  process.parentPort.postMessage(response)
}

/**
 * Never throws, for the reason `catalog-dispatch` gives: a message loop that dies leaves the
 * main process holding promises nobody settles. Here it would take down every waveform running
 * at that moment, not just the file that caused it — one process serves them all.
 */
process.parentPort.on('message', event => {
  const message: PeaksMessage = event.data

  try {
    if (isCancel(message)) {
      running.get(message.id)?.abort()
      return
    }

    const controller = new AbortController()
    running.set(message.id, controller)

    const reducer = createPeakReducer(message.buckets, message.samplesPerBucket)
    runProcess(message.binary, message.args, {
      signal: controller.signal,
      onStdout: chunk => reducer.push(chunk),
    })
      .then(
        () => reply({ id: message.id, ok: true, peaks: reducer.finish() }),
        (error: unknown) => reply({ id: message.id, ok: false, error: String(error) }),
      )
      .finally(() => running.delete(message.id))
  } catch (error) {
    running.delete(message.id)
    reply({ id: message.id, ok: false, error: String(error) })
  }
})
