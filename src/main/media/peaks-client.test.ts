import { describe, expect, it } from 'vitest'
import { createPeaksClient, type PeaksPort } from './peaks-client'
import { isCancel, type PeaksMessage, type PeaksResponse } from './peaks-protocol'

/** The worker, reduced to a table of what it was sent and a way to answer it. */
function fakePort() {
  const sent: PeaksMessage[] = []
  let answer: (response: PeaksResponse) => void = () => {}
  let fail: (error: Error) => void = () => {}

  const port: PeaksPort = {
    postMessage: message => sent.push(message),
    onMessage: listener => (answer = listener),
    onFailure: listener => (fail = listener),
  }

  return { port, sent, answer: (r: PeaksResponse) => answer(r), fail: (e: Error) => fail(e) }
}

const run = { binary: '/usr/bin/ffmpeg', args: ['-i', 'a.wav'], buckets: 4, samplesPerBucket: 160 }

describe('the waveform client', () => {
  it('asks the worker and hands back what it answered', async () => {
    const { port, sent, answer } = fakePort()
    const pending = createPeaksClient(port).compute(run)

    expect(sent[0]).toMatchObject({ id: 1, binary: '/usr/bin/ffmpeg', buckets: 4 })
    answer({ id: 1, ok: true, peaks: Float32Array.from([-1, 1]) })

    expect([...(await pending)]).toEqual([-1, 1])
  })

  it('rejects with what the worker said went wrong', async () => {
    const { port, answer } = fakePort()
    const pending = createPeaksClient(port).compute(run)

    answer({ id: 1, ok: false, error: 'ffmpeg exited with 1' })
    await expect(pending).rejects.toThrow(/ffmpeg exited with 1/)
  })

  // Two rushes ingest at once, and their answers can come back in either order.
  it('tells two runs apart by their id', async () => {
    const { port, answer } = fakePort()
    const client = createPeaksClient(port)

    const first = client.compute(run)
    const second = client.compute(run)

    answer({ id: 2, ok: true, peaks: Float32Array.from([2]) })
    answer({ id: 1, ok: true, peaks: Float32Array.from([1]) })

    expect([...(await first)]).toEqual([1])
    expect([...(await second)]).toEqual([2])
  })

  it('tells the worker to stop when the ingest is cancelled', async () => {
    const controller = new AbortController()
    const { port, sent } = fakePort()
    const pending = createPeaksClient(port).compute({ ...run, signal: controller.signal })

    controller.abort()
    expect(sent.some(message => isCancel(message))).toBe(true)

    // The worker still answers — killing ffmpeg makes it fail — and that is what settles it.
    pending.catch(() => {})
  })

  it('refuses to start a run that was cancelled before it was asked for', async () => {
    const controller = new AbortController()
    controller.abort()
    const { port, sent } = fakePort()

    await expect(
      createPeaksClient(port).compute({ ...run, signal: controller.signal }),
    ).rejects.toThrow()
    expect(sent).toEqual([])
  })

  // A dead process answers nothing, ever: an ingest waiting on it would hold its pool slot
  // for the rest of the session.
  it('rejects everything still waiting when the process dies', async () => {
    const { port, fail } = fakePort()
    const pending = createPeaksClient(port).compute(run)

    fail(new Error('waveform process exited with code 1'))
    await expect(pending).rejects.toThrow(/exited with code 1/)
  })

  // Between the process dying and its `exit` reaching us, `postMessage` is a silent no-op:
  // a run posted then would wait for an answer that can never come, holding its pool slot.
  it('refuses a new run once the process is known to be gone', async () => {
    const { port, fail, sent } = fakePort()
    const client = createPeaksClient(port)

    fail(new Error('waveform process exited with code 1'))

    await expect(client.compute(run)).rejects.toThrow(/gone/)
    expect(sent).toEqual([])
  })

  it('forgets a run the port refused to carry', async () => {
    const port: PeaksPort = {
      postMessage: () => {
        throw new Error('channel closed')
      },
      onMessage: () => {},
      onFailure: () => {},
    }

    await expect(createPeaksClient(port).compute(run)).rejects.toThrow(/channel closed/)
  })

  it('ignores an answer to a run already settled', async () => {
    const { port, answer } = fakePort()
    const pending = createPeaksClient(port).compute(run)

    answer({ id: 1, ok: true, peaks: Float32Array.from([1]) })
    await pending

    expect(() => answer({ id: 1, ok: false, error: 'late' })).not.toThrow()
  })
})

describe('the waveform protocol', () => {
  it('tells a cancellation from a request', () => {
    expect(isCancel({ id: 1, cancel: true })).toBe(true)
    expect(isCancel({ id: 1, ...run })).toBe(false)
  })
})
