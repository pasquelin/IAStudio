import { describe, expect, it, vi } from 'vitest'
import { localModel } from '@shared/domain/localModel-fixtures'
import { createLocalJobRunner, type LocalJobDeps } from './localJobRunner'
import type { ChatRequest } from './localRuntimes'

const MODEL = localModel({ id: 'local_one', loader: 'llamacpp', contextTokens: 4_096 })

const runnerWith = (over: Partial<LocalJobDeps> = {}) => {
  let count = 0

  return createLocalJobRunner({
    chat: () => Promise.resolve('a picture of a cat'),
    modelOf: id => (id === MODEL.id ? MODEL : null),
    newId: () => `${(count += 1)}`,
    log: () => {},
    ...over,
  })
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('the local job runner', () => {
  /**
   * `poll` is a remote form, kept rather than worked around: the manager holds the queue, the
   * concurrency bound and the retries, and giving it a second implementation to grow was the
   * alternative. So the work happens here and the poll reads the state it left.
   */
  it('answers a submission at once and finishes under the poll', async () => {
    const runner = runnerWith()

    // Already working when the submission answers: nothing queues on this machine, the runtime
    // is right here, and the manager's own queue is what bounds how many run at once.
    const submitted = await runner.submit({ id: MODEL.id }, { prompt: 'a cat' })
    expect(submitted.status).toBe('in-progress')

    await settled()
    expect((await runner.poll(submitted.jobId)).status).toBe('success')
    expect(runner.outputOf(submitted.jobId)).toBe('a picture of a cat')
  })

  // Nothing was billed, and saying zero keeps a local run out of the usage report as a figure
  // rather than as a hole.
  it('prices a run on this machine at nothing', async () => {
    const submitted = await runnerWith().submit({ id: MODEL.id }, {})

    expect(submitted.cost).toBe(0)
  })

  it('stops a run it is asked to cancel, and files it as failed', async () => {
    const chat = vi.fn(
      (request: ChatRequest) =>
        new Promise<string>((_ok, no) => {
          request.signal?.addEventListener('abort', () => no(new Error('aborted')))
        }),
    )
    const runner = runnerWith({ chat })

    const submitted = await runner.submit({ id: MODEL.id }, {})
    await settled()
    await runner.cancel(submitted.jobId)
    await settled()

    expect((await runner.poll(submitted.jobId)).status).toBe('failure')
  })

  // A target this runner does not own reaching it is a routing defect, and answering `failure`
  // would hide the defect behind an ordinary-looking outcome.
  it('files a model it does not hold as a failure, and refuses a poll it never issued', async () => {
    const runner = runnerWith()

    expect((await runner.submit({ id: 'model_flux' }, {})).status).toBe('failure')
    await expect(runner.poll('local_nobody')).rejects.toThrow(/this machine/)
  })

  // Which of the two runners owns a poll is read off the id, so it has to be readable as one.
  it('owns the jobs it issued and none of the others', async () => {
    const runner = runnerWith()
    const submitted = await runner.submit({ id: MODEL.id }, {})

    expect(runner.owns(submitted.jobId)).toBe(true)
    expect(runner.owns('job_from_the_cloud')).toBe(false)
  })
})
