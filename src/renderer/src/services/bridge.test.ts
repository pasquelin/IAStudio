import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectThroughBridge } from './bridge'
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
