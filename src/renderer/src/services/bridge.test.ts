import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectThroughBridge, memoryBridge } from './bridge'
import { installFakeBridge } from './fakeBridge'

afterEach(() => vi.unstubAllGlobals())

describe('connecting through the bridge', () => {
  it('joins once there is a bridge, and hands back what unsubscribes', async () => {
    installFakeBridge()
    const stop = vi.fn()

    expect(await connectThroughBridge(async () => stop)()).toBe(stop)
  })

  // A test and a plain browser both run without one. Nothing was subscribed to, so the caller
  // must still get something it can call on unmount rather than a thrown error.
  it('joins nothing without a bridge, and still answers something callable', async () => {
    vi.stubGlobal('studio', undefined)
    const join = vi.fn()

    expect(() => connectThroughBridge(join)()).not.toThrow()
    expect(await connectThroughBridge(join)()).toBeTypeOf('function')
    expect(join).not.toHaveBeenCalled()
  })
})

describe('the memory half of the bridge', () => {
  /**
   * 🛑 A DEVELOPMENT window whose preload predates this branch has every other half and not this
   * one. `getBridge()?.memory.remember(…)` guards the bridge and not the half, so it threw where
   * every caller expected a bridge that answers nothing — and `rememberOutcome` is called on a
   * `void`, which makes that throw an unhandled rejection.
   */
  it('answers nothing for a preload that has no memory at all', () => {
    vi.stubGlobal('studio', {})

    expect(memoryBridge()).toBeUndefined()
    expect(() => memoryBridge()?.remember('project', undefined as never)).not.toThrow()
  })

  it('answers nothing without a bridge at all', () => {
    vi.stubGlobal('studio', undefined)

    expect(memoryBridge()).toBeUndefined()
  })
})
