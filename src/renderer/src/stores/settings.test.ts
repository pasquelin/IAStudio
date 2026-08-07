import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from './settings'

const COMPACT: Settings = {
  ...DEFAULT_SETTINGS,
  appearance: { theme: 'dark', density: 'compact' },
}

describe('settings store', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS, loaded: false })
  })

  it('loads what the main process holds', async () => {
    installFakeBridge({ settings: { read: () => Promise.resolve(COMPACT) } })

    await useSettings.getState().connect()

    expect(useSettings.getState().settings.appearance.density).toBe('compact')
    expect(useSettings.getState().loaded).toBe(true)
  })

  /**
   * The reason the event exists: settings live in the main process, and a window that only
   * refreshed on its own writes would show a theme the settings window changed an hour ago.
   */
  it('follows a change another window made', async () => {
    const listeners: ((settings: Settings) => void)[] = []
    installFakeBridge({
      settings: {
        onChange: callback => {
          listeners.push(callback)
          return () => {}
        },
      },
    })

    await useSettings.getState().connect()
    listeners[0]?.(COMPACT)

    expect(useSettings.getState().settings.appearance.density).toBe('compact')
  })

  it('stops listening when the window it belongs to goes away', async () => {
    const stop = vi.fn()
    installFakeBridge({ settings: { onChange: () => stop } })

    const unsubscribe = await useSettings.getState().connect()
    unsubscribe()

    expect(stop).toHaveBeenCalledOnce()
  })

  // Subscribing after the read would miss a change landing between the two.
  it('listens before it asks, so nothing slips through the gap', async () => {
    const order: string[] = []
    installFakeBridge({
      settings: {
        onChange: () => {
          order.push('subscribe')
          return () => {}
        },
        read: () => {
          order.push('read')
          return Promise.resolve(DEFAULT_SETTINGS)
        },
      },
    })

    await useSettings.getState().connect()

    expect(order).toEqual(['subscribe', 'read'])
  })

  it('writes one leaf without disturbing the rest', async () => {
    const write = vi.fn(() => Promise.resolve(COMPACT))
    installFakeBridge({ settings: { write } })

    await useSettings.getState().setValue('appearance.density', 'compact')

    expect(write).toHaveBeenCalledWith({ appearance: { density: 'compact' } })
  })

  it('survives having no bridge at all, as a plain browser has none', async () => {
    vi.unstubAllGlobals()

    const unsubscribe = await useSettings.getState().connect()

    expect(unsubscribe).toBeTypeOf('function')
    expect(useSettings.getState().loaded).toBe(false)
  })
})
