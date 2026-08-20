import { describe, expect, it, vi } from 'vitest'
import { createCredentialsWatch } from './credentialsWatch'

describe('credentials watch', () => {
  it('runs every purge on a change', () => {
    const watch = createCredentialsWatch()
    const models = vi.fn()
    const client = vi.fn()

    watch.watch(models)
    watch.watch(client)
    watch.changed()

    expect(models).toHaveBeenCalledOnce()
    expect(client).toHaveBeenCalledOnce()
  })

  it('runs them in subscription order', () => {
    const watch = createCredentialsWatch()
    const order: string[] = []

    watch.watch(() => order.push('client'))
    watch.watch(() => order.push('models'))
    watch.changed()

    expect(order).toEqual(['client', 'models'])
  })

  it('runs nothing before a change, and again on the next one', () => {
    const watch = createCredentialsWatch()
    const purge = vi.fn()

    watch.watch(purge)
    expect(purge).not.toHaveBeenCalled()

    watch.changed()
    watch.changed()
    expect(purge).toHaveBeenCalledTimes(2)
  })

  it('drops a cache that unsubscribes', () => {
    const watch = createCredentialsWatch()
    const purge = vi.fn()

    watch.watch(purge)()
    watch.changed()

    expect(purge).not.toHaveBeenCalled()
  })

  // Iterating the live set would skip the neighbour of whoever unsubscribed.
  it('still runs the others when one unsubscribes as it purges', () => {
    const watch = createCredentialsWatch()
    const second = vi.fn()

    let stop: (() => void) | null = null
    stop = watch.watch(() => stop?.())
    watch.watch(second)
    watch.changed()

    expect(second).toHaveBeenCalledOnce()
  })
})
