import { describe, expect, it, vi } from 'vitest'
import { createShutdown, type ShutdownDeps } from './shutdown'

const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

function harness(overrides: Partial<ShutdownDeps> = {}) {
  const quit = vi.fn()
  const yielded: Array<() => void> = []

  const onWillQuit = createShutdown({
    settle: () => Promise.resolve(),
    quit,
    yieldTo: run => yielded.push(run),
    ...overrides,
  })

  /** Runs what the shutdown handed to the next turn, and says so when it handed nothing. */
  const takeTurn = async (): Promise<void> => {
    await settled()
    const run = yielded.shift()
    if (!run) throw new Error('nothing was deferred to a later turn')
    run()
  }

  return { onWillQuit, quit, yielded, takeTurn, event: { preventDefault: vi.fn() } }
}

describe('createShutdown', () => {
  it('holds the quit open while what is in memory is written', () => {
    const { onWillQuit, event, quit } = harness()

    onWillQuit(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(quit).not.toHaveBeenCalled()
  })

  /**
   * The defect this module exists for: a settle with nothing to write resolves in a microtask of
   * the tick that just prevented the default, and Electron drops a quit issued there.
   */
  it('never quits in the turn that prevented the default', async () => {
    const { onWillQuit, event, quit, yielded } = harness()

    onWillQuit(event)
    await settled()

    expect(quit).not.toHaveBeenCalled()
    expect(yielded).toHaveLength(1)

    yielded[0]?.()
    expect(quit).toHaveBeenCalledOnce()
  })

  it('quits once the writes are through', async () => {
    // Written out rather than `Promise.withResolvers`: the compiler targets a library older
    // than ES2024, and raising it for one test would be a change of its own.
    let write = (): void => {}
    const writes = new Promise<void>(resolve => (write = resolve))
    const { onWillQuit, event, quit, yielded, takeTurn } = harness({ settle: () => writes })

    onWillQuit(event)
    await settled()
    expect(yielded).toHaveLength(0)

    write()
    await takeTurn()

    expect(quit).toHaveBeenCalledOnce()
  })

  /**
   * `settle` does synchronous work before it returns a promise — the dictation is disposed
   * there. A throw from that must not escape, or the quit stays prevented with nothing left to
   * lift it and the studio refuses to close at all.
   */
  it('quits when settling throws before it returns a promise', async () => {
    const { onWillQuit, event, quit, takeTurn } = harness({
      settle: () => {
        throw new Error('disposing the recogniser failed')
      },
    })

    onWillQuit(event)
    await takeTurn()

    expect(quit).toHaveBeenCalledOnce()
  })

  // A disk that refuses the last lines is no reason to keep the studio on screen for ever.
  it('quits even when the writes fail', async () => {
    const { onWillQuit, event, quit, takeTurn } = harness({
      settle: () => Promise.reject(new Error('disk full')),
    })

    onWillQuit(event)
    await takeTurn()

    expect(quit).toHaveBeenCalledOnce()
  })

  // The second one is Electron's own, once the quit is let through: preventing it again would
  // hold the process open for a flush that already happened.
  it('lets a later quit through untouched', async () => {
    const { onWillQuit, event, quit, takeTurn } = harness()

    onWillQuit(event)
    await takeTurn()

    const second = { preventDefault: vi.fn() }
    onWillQuit(second)

    expect(second.preventDefault).not.toHaveBeenCalled()
    expect(quit).toHaveBeenCalledOnce()
  })
})
