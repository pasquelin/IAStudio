import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import type { Updates } from '@main/updater'
import { registerUpdateHandlers } from './handlers'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

describe('the update handlers', () => {
  let updates: Updates

  beforeEach(() => {
    resetHandlers()
    updates = {
      state: () => ({ phase: 'ready', version: '0.2.0' }),
      check: vi.fn(() => Promise.resolve()),
      install: vi.fn(),
    }
    registerUpdateHandlers({ updates })
  })

  it('answers the state the updater holds', () => {
    expect(invoke(CHANNELS.updateState)).toEqual({ phase: 'ready', version: '0.2.0' })
  })

  it('installs through its channel', () => {
    invoke(CHANNELS.updateInstall)

    expect(updates.install).toHaveBeenCalled()
  })
})
