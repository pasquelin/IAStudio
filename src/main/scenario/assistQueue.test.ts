import { APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import { createAssistQueue, type AssistQueueDeps } from './assistQueue'

function queueOf(overrides: Partial<AssistQueueDeps> = {}) {
  return createAssistQueue({
    concurrency: () => 2,
    maxRetries: () => 0,
    sleep: async () => {},
    backoffBaseMs: 1,
    ...overrides,
  })
}

/** A task that answers only when told to, so a test can hold the queue mid-flight. */
function held<T>(value: T) {
  let release = (): void => {}
  const settled = new Promise<void>(resolve => {
    release = resolve
  })
  const task = vi.fn(() => settled.then(() => value))
  return { task, release: () => release() }
}

describe('createAssistQueue', () => {
  it('answers what the task answered', async () => {
    const queue = queueOf()

    await expect(queue.run(async () => 'described')).resolves.toBe('described')
  })

  it('rejects with what the task threw, once the retries are spent', async () => {
    const queue = queueOf()

    await expect(queue.run(async () => Promise.reject(new Error('refused')))).rejects.toThrow(
      'refused',
    )
  })

  // The burst CLAUDE.md lists as a known trap: three hundred arrivals, three hundred calls.
  it('never runs more at once than it is allowed', async () => {
    const queue = queueOf({ concurrency: () => 2 })
    const first = held('one')
    const second = held('two')
    const third = held('three')

    const all = [queue.run(first.task), queue.run(second.task), queue.run(third.task)]

    expect(first.task).toHaveBeenCalled()
    expect(second.task).toHaveBeenCalled()
    expect(third.task).not.toHaveBeenCalled()

    first.release()
    second.release()
    third.release()
    await Promise.all(all)

    expect(third.task).toHaveBeenCalled()
  })

  it('starts the next one as soon as a slot frees up', async () => {
    const queue = queueOf({ concurrency: () => 1 })
    const first = held('one')
    const second = held('two')

    const running = [queue.run(first.task), queue.run(second.task)]
    expect(second.task).not.toHaveBeenCalled()

    first.release()
    await running[0]
    expect(second.task).toHaveBeenCalled()

    second.release()
    await Promise.all(running)
  })

  // The bound comes from the preferences: a queue drained over minutes must follow a change.
  it('reads the bound again on every dispatch', async () => {
    let allowed = 1
    const queue = queueOf({ concurrency: () => allowed })
    const first = held('one')
    const second = held('two')

    const running = [queue.run(first.task), queue.run(second.task)]
    expect(second.task).not.toHaveBeenCalled()

    allowed = 2
    const third = held('three')
    running.push(queue.run(third.task))

    expect(second.task).toHaveBeenCalled()

    first.release()
    second.release()
    third.release()
    await Promise.all(running)
  })

  it('retries what waiting can fix', async () => {
    const queue = queueOf({ maxRetries: () => 2 })
    let attempts = 0
    const task = vi.fn(async () => {
      attempts++
      if (attempts < 3) throw APIError.generate(429, undefined, undefined, new Headers())
      return attempts
    })

    await expect(queue.run(task)).resolves.toBe(3)
  })
})
