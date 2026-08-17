import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/domain/update'
import { installFakeBridge } from '@/services/fakeBridge'
import { useUpdates } from './updates'

beforeEach(() => {
  useUpdates.setState({ update: { phase: 'idle' } })
})

describe('the updates store', () => {
  // A window opened after the download finished gets no further event: without seeding, the
  // indicator would stay silent with an update sitting ready on disk.
  it('seeds itself from the state the main process already holds', async () => {
    installFakeBridge({
      updates: { state: () => Promise.resolve({ phase: 'ready', version: '0.3.0' }) },
    })

    await useUpdates.getState().connect()

    expect(useUpdates.getState().update).toEqual({ phase: 'ready', version: '0.3.0' })
  })

  it('follows what the main process pushes afterwards', async () => {
    const listeners: ((state: UpdateState) => void)[] = []
    installFakeBridge({
      updates: {
        onState: callback => {
          listeners.push(callback)
          return () => {}
        },
      },
    })

    await useUpdates.getState().connect()
    for (const push of listeners) push({ phase: 'downloading', version: '0.3.0', progress: 0.5 })

    expect(useUpdates.getState().update).toEqual({
      phase: 'downloading',
      version: '0.3.0',
      progress: 0.5,
    })
  })

  it('hands the unsubscribe back to whoever connected', async () => {
    const stop = vi.fn()
    installFakeBridge({ updates: { onState: () => stop } })

    const unsubscribe = await useUpdates.getState().connect()
    unsubscribe()

    expect(stop).toHaveBeenCalled()
  })

  it('asks the main process to install', async () => {
    const install = vi.fn(() => Promise.resolve())
    installFakeBridge({ updates: { install } })

    await useUpdates.getState().install()

    expect(install).toHaveBeenCalled()
  })
})
