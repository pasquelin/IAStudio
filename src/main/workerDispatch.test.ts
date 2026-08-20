import { describe, expect, it } from 'vitest'
import { createWorkerDispatch } from './workerDispatch'

/** A protocol reduced to what a dispatch reads of one: an id, a job, and a way to cancel it. */
type Job = { id: number }
type Cancel = { id: number; cancel: true }
type Message = Job | Cancel
type Response = { id: number; text: string }

const isJob = (message: Message): message is Job => !('cancel' in message)

/** The worker's turn, plus the turns its work takes to settle. */
const settled = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

function serve(run: (job: Job, signal: AbortSignal) => Promise<Response>) {
  const sent: Response[] = []

  const dispatch = createWorkerDispatch<Message, Job, Response>({
    reply: response => void sent.push(response),
    isJob,
    run,
    failed: (id, error) => ({ id, text: `failed: ${String(error)}` }),
  })

  return { sent, dispatch }
}

describe('a worker dispatch', () => {
  it('answers the run with what the work settled on', async () => {
    const { sent, dispatch } = serve(job => Promise.resolve({ id: job.id, text: 'done' }))

    dispatch({ id: 1 })
    await settled()

    expect(sent).toEqual([{ id: 1, text: 'done' }])
  })

  // A loop that throws takes every other run down with it, so a failure travels as an answer.
  it('answers a failure when the work rejects', async () => {
    const { sent, dispatch } = serve(() => Promise.reject(new Error('ffmpeg is gone')))

    dispatch({ id: 1 })
    await settled()

    expect(sent).toEqual([{ id: 1, text: 'failed: Error: ffmpeg is gone' }])
  })

  it('answers a failure when the work throws before it returns anything', () => {
    const { sent, dispatch } = serve(() => {
      throw new Error('no binary')
    })

    expect(() => dispatch({ id: 1 })).not.toThrow()
    expect(sent).toEqual([{ id: 1, text: 'failed: Error: no binary' }])
  })

  // Two rushes reduce at once: cancelling one must not stop the one running beside it.
  it('aborts the run a cancel names, and only that one', () => {
    const signals = new Map<number, AbortSignal>()
    const { dispatch } = serve((job, signal) => {
      signals.set(job.id, signal)
      return new Promise<Response>(() => {})
    })

    dispatch({ id: 1 })
    dispatch({ id: 2 })
    dispatch({ id: 2, cancel: true })

    expect(signals.get(1)?.aborted).toBe(false)
    expect(signals.get(2)?.aborted).toBe(true)
  })

  // A cancel racing the last chunk is ordinary, and the table it would grow is never emptied
  // anywhere else: the process lives as long as the session does.
  it('forgets a run that settled, so a cancel arriving late aborts nothing', async () => {
    const signals = new Map<number, AbortSignal>()
    const { dispatch } = serve((job, signal) => {
      signals.set(job.id, signal)
      return Promise.resolve({ id: job.id, text: 'done' })
    })

    dispatch({ id: 1 })
    await settled()
    dispatch({ id: 1, cancel: true })

    expect(signals.get(1)?.aborted).toBe(false)
  })
})
