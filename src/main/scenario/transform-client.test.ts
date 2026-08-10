import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTransformClient, type TransformPort } from './transform-client'
import type { TransformRequest, TransformResponse } from './transform-protocol'

/**
 * A thread the test drives by hand: it records what was posted and answers when told to, which
 * is the only way to hold an evaluation open past its deadline without waiting for one.
 */
function fakePort(): TransformPort & {
  posted: TransformRequest[]
  answer: (response: TransformResponse) => void
  fail: (error: Error) => void
  terminated: number
} {
  const posted: TransformRequest[] = []
  const listeners: ((response: TransformResponse) => void)[] = []
  const failures: ((error: Error) => void)[] = []
  const port = {
    posted,
    terminated: 0,
    postMessage: (request: TransformRequest) => posted.push(request),
    onMessage: (listener: (response: TransformResponse) => void) => listeners.push(listener),
    onFailure: (listener: (error: Error) => void) => failures.push(listener),
    terminate: () => {
      port.terminated += 1
    },
    answer: (response: TransformResponse) => listeners.forEach(listener => listener(response)),
    fail: (error: Error) => failures.forEach(listener => listener(error)),
  }

  return port
}

describe('the transform client', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts no thread until an expression is evaluated', () => {
    const open = vi.fn(fakePort)
    createTransformClient(open, () => {})

    expect(open).not.toHaveBeenCalled()
  })

  it('answers with what the thread computed', async () => {
    const port = fakePort()
    const client = createTransformClient(
      () => port,
      () => {},
    )

    const answer = client.evaluate("'a' + 'b'", { x: 'unused' })
    expect(port.posted[0]).toMatchObject({ expression: "'a' + 'b'", variables: { x: 'unused' } })
    port.answer({ id: port.posted[0]?.id ?? 0, ok: true, values: ['ab'] })

    await expect(answer).resolves.toEqual(['ab'])
  })

  it('reuses the one thread rather than starting one per expression', async () => {
    const port = fakePort()
    const open = vi.fn(() => port)
    const client = createTransformClient(open, () => {})

    const first = client.evaluate('1', {})
    port.answer({ id: port.posted[0]?.id ?? 0, ok: true, values: ['1'] })
    await first
    const second = client.evaluate('2', {})
    port.answer({ id: port.posted[1]?.id ?? 0, ok: true, values: ['2'] })
    await second

    expect(open).toHaveBeenCalledOnce()
  })

  it('answers null and journals the reason when the thread refuses the expression', async () => {
    const port = fakePort()
    const report = vi.fn()
    const client = createTransformClient(() => port, report)

    const answer = client.evaluate('nope(', {})
    port.answer({ id: port.posted[0]?.id ?? 0, ok: false, reason: 'nope(: ParseError' })

    await expect(answer).resolves.toBeNull()
    expect(report).toHaveBeenCalledWith('nope(: ParseError')
  })

  /**
   * The claim this whole client exists for. A backtracking regex cannot be interrupted from
   * inside — no signal reaches it — so the deadline has to KILL the thread, and an evaluation
   * that never answers must still let its caller go.
   */
  it('kills a thread that will not answer, and lets the caller go', async () => {
    const port = fakePort()
    const report = vi.fn()
    const client = createTransformClient(() => port, report, 2000)

    const answer = client.evaluate("x.matches('(a+)+$')", { x: 'aaaa!' })
    await vi.advanceTimersByTimeAsync(2000)

    await expect(answer).resolves.toBeNull()
    expect(port.terminated).toBe(1)
    expect(report).toHaveBeenCalledWith(expect.stringContaining('gave up'))
  })

  /** A killed thread is gone: the next expression must reach a NEW one, not a dead port. */
  it('starts a fresh thread for the next expression after one was killed', async () => {
    const first = fakePort()
    const second = fakePort()
    const ports = [first, second]
    const client = createTransformClient(
      () => ports.shift() ?? second,
      () => {},
    )

    const abandoned = client.evaluate('slow', {})
    await vi.advanceTimersByTimeAsync(2000)
    await abandoned

    const answer = client.evaluate("'later'", {})
    second.answer({ id: second.posted[0]?.id ?? 0, ok: true, values: ['later'] })

    await expect(answer).resolves.toEqual(['later'])
    expect(second.posted).toHaveLength(1)
  })

  /** Everything waiting on a thread that dies is waiting for good — they are let go instead. */
  it('lets every waiting caller go when the thread dies', async () => {
    const port = fakePort()
    const report = vi.fn()
    const client = createTransformClient(() => port, report)

    const first = client.evaluate('a', {})
    const second = client.evaluate('b', {})
    port.fail(new Error('killed by the OS'))

    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBeNull()
    expect(report).toHaveBeenCalledWith(expect.stringContaining('killed by the OS'))
  })

  /** A thread already gone swallows `postMessage` in silence, which would hold a caller for good. */
  it('answers null rather than throwing when the thread will not take the message', async () => {
    const port = fakePort()
    port.postMessage = () => {
      throw new Error('port is closed')
    }
    const report = vi.fn()
    const client = createTransformClient(() => port, report)

    await expect(client.evaluate('a', {})).resolves.toBeNull()
    expect(report).toHaveBeenCalledWith(expect.stringContaining('port is closed'))
  })

  it('stops the thread and lets its callers go when the app closes', async () => {
    const port = fakePort()
    const client = createTransformClient(
      () => port,
      () => {},
    )

    const answer = client.evaluate('a', {})
    client.close()

    await expect(answer).resolves.toBeNull()
    expect(port.terminated).toBe(1)
  })

  /** A late answer to an evaluation already given up on must not resolve anything twice. */
  it('ignores an answer that arrives after the deadline', async () => {
    const port = fakePort()
    const client = createTransformClient(
      () => port,
      () => {},
      2000,
    )

    const answer = client.evaluate('slow', {})
    await vi.advanceTimersByTimeAsync(2000)
    port.answer({ id: port.posted[0]?.id ?? 0, ok: true, values: ['too late'] })

    await expect(answer).resolves.toBeNull()
  })
})
