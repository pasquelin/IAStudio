import { createWorkerDispatch } from '@main/workerDispatch'
import { createPeakReducer } from './peaks'
import { runProcess } from './runner'
import { isCancel, type PeaksCancel, type PeaksMessage, type PeaksResponse } from './peaksProtocol'

/**
 * The waveform's own process. Everything here is plumbing — the reducer, the runner and the
 * dispatch are tested on their own, and this file owns nothing but the port.
 *
 * A `utilityProcess`, which is what CLAUDE.md § 6 asks for around ffmpeg: the reduction of an
 * hour of PCM measured 129 ms on the main thread, and every window of the studio waited it out.
 */

const reply = (response: PeaksResponse): void => {
  process.parentPort.postMessage(response)
}

const isJob = (message: PeaksMessage): message is Exclude<PeaksMessage, PeaksCancel> =>
  !isCancel(message)

const dispatch = createWorkerDispatch({
  reply,
  isJob,
  run: (job, signal) => {
    const reducer = createPeakReducer(job.buckets, job.samplesPerBucket)

    return runProcess(job.binary, job.args, {
      signal,
      onStdout: chunk => reducer.push(chunk),
    }).then((): PeaksResponse => ({ id: job.id, ok: true, peaks: reducer.finish() }))
  },
  failed: (id, error): PeaksResponse => ({ id, ok: false, error: String(error) }),
})

process.parentPort.on('message', event => dispatch(event.data))
