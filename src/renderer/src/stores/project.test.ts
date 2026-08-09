import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { useProject } from './project'

beforeEach(() => {
  useProject.setState({ project: null, known: false })
  installFakeBridge()
})

/**
 * `known` is what the home waits on before drawing anything: the initial `null` is "not asked
 * yet", not "no project". Every way out of `connect` has to settle it, or the studio opens on a
 * blank page nothing will ever fill.
 */
describe('saying that the answer has arrived', () => {
  it('settles on what the main process holds', async () => {
    await useProject.getState().connect()

    expect(useProject.getState().known).toBe(true)
    expect(useProject.getState().project).toBeNull()
  })

  it('settles even with no bridge to ask, as a plain browser has none', async () => {
    vi.unstubAllGlobals()

    const stop = await useProject.getState().connect()

    expect(useProject.getState().known).toBe(true)
    expect(stop).toBeTypeOf('function')
  })

  // Left to throw, `connect` also never hands back the unsubscribe, stranding the listener.
  it('settles when the main process refuses to say which project is open', async () => {
    installFakeBridge({ project: { current: () => Promise.reject(new Error('no project')) } })

    const stop = await useProject.getState().connect()

    expect(useProject.getState().known).toBe(true)
    expect(stop).toBeTypeOf('function')
  })
})
