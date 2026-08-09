import { describe, expect, it, vi } from 'vitest'
import { createSerial } from './serial'

/** A task that settles when told, so two can be in flight at once — or prove they cannot. */
function deferred() {
  let release: () => void = () => {}
  const settled = new Promise<void>(resolve => {
    release = resolve
  })
  return { settled, release }
}

describe('createSerial', () => {
  // The bug this exists for: a decode takes several hundred milliseconds and audio arrives
  // every hundred, so without a queue the second chunk enters the engine while the first is
  // still inside it.
  it('never lets a task start before the previous one has finished', async () => {
    const serial = createSerial(vi.fn())
    const first = deferred()
    const running: string[] = []

    const one = serial.run(async () => {
      running.push('one in')
      await first.settled
      running.push('one out')
    })
    const two = serial.run(async () => {
      running.push('two in')
    })

    // One tick: a queued task starts on the next microtask, never synchronously — which is
    // what makes the order below a property of the queue rather than of the call site.
    await Promise.resolve()
    expect(running).toEqual(['one in'])

    first.release()
    await Promise.all([one, two])

    expect(running).toEqual(['one in', 'one out', 'two in'])
  })

  it('runs them in the order they were given', async () => {
    const serial = createSerial(vi.fn())
    const order: number[] = []

    const all = [1, 2, 3, 4].map(index =>
      serial.run(async () => {
        // Awaiting inside is what would let a later task overtake an earlier one.
        await Promise.resolve()
        order.push(index)
      }),
    )
    await Promise.all(all)

    expect(order).toEqual([1, 2, 3, 4])
  })

  // A rejected link would make every task queued behind it fail too, for a reason that has
  // nothing to do with them — and in the worker, that is every chunk of the rest of the session.
  it('reports a failure and keeps running what came after', async () => {
    const onFailure = vi.fn()
    const serial = createSerial(onFailure)
    const after = vi.fn()

    await serial.run(() => Promise.reject(new Error('the decoder refused a segment')))
    await serial.run(async () => {
      after()
    })

    expect(onFailure).toHaveBeenCalledWith(new Error('the decoder refused a segment'))
    expect(after).toHaveBeenCalled()
  })

  it('settles the caller of a task that threw, rather than leaving it hanging', async () => {
    const serial = createSerial(vi.fn())

    await expect(serial.run(() => Promise.reject(new Error('gone')))).resolves.toBeUndefined()
  })
})
