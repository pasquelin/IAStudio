import { describe, expect, it } from 'vitest'
import { boundedPool } from './boundedPool'

/** A task whose settling the test controls, so a pool can be caught mid-flight. */
function held(): { task: () => Promise<string>; finish: () => void; started: () => boolean } {
  let start: (() => void) | null = null
  let begun = false

  return {
    task: () =>
      new Promise<string>(resolve => {
        begun = true
        start = () => resolve('done')
      }),
    finish: () => start?.(),
    started: () => begun,
  }
}

describe('boundedPool', () => {
  it('runs up to the limit and holds the rest back', async () => {
    const pool = boundedPool(() => 2)
    const [one, two, three] = [held(), held(), held()]

    const all = Promise.all([pool.run(one.task), pool.run(two.task), pool.run(three.task)])

    expect(three.started()).toBe(false)
    one.finish()
    await Promise.resolve()
    expect(three.started()).toBe(true)

    two.finish()
    three.finish()
    await expect(all).resolves.toEqual(['done', 'done', 'done'])
  })

  /**
   * The slot has to come back however the task ends — a thunk that throws before its first await
   * would otherwise keep it for the life of the process, and the pool wedges after `limit` of
   * them with every later caller waiting on a promise that settles neither way.
   */
  it('gives the slot back when the task throws synchronously', async () => {
    const pool = boundedPool(() => 1)

    await expect(
      pool.run(() => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    await expect(pool.run(async () => 'after')).resolves.toBe('after')
  })

  it('gives the slot back when the task rejects', async () => {
    const pool = boundedPool(() => 1)

    await expect(pool.run(async () => Promise.reject(new Error('late')))).rejects.toThrow('late')
    await expect(pool.run(async () => 'after')).resolves.toBe('after')
  })

  // Read per acquisition rather than captured: a limit that comes from a setting must follow a
  // user who lowers it while a queue drains.
  it('reads the limit again for every dispatch', async () => {
    let limit = 0
    const pool = boundedPool(() => limit)
    const one = held()

    const running = pool.run(one.task)
    expect(one.started()).toBe(false)

    limit = 1
    const second = pool.run(async () => 'second')

    one.finish()
    await expect(running).resolves.toBe('done')
    await expect(second).resolves.toBe('second')
  })
})
