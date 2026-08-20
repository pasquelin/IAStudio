import { create } from 'zustand'
import type { UpdateState } from '@shared/domain/update'
import { connectThroughBridge, getBridge } from '@/services/bridge'

type UpdatesState = {
  update: UpdateState
  /** Reads the current state and follows it. Returns the unsubscribe function. */
  connect: () => Promise<() => void>
  install: () => Promise<void>
}

export const useUpdates = create<UpdatesState>()(set => ({
  update: { phase: 'idle' },

  connect: connectThroughBridge(async bridge => {
    const stop = bridge.updates.onState(update => set({ update }))
    set({ update: await bridge.updates.state() })
    return stop
  }),

  install: async () => {
    await getBridge()?.updates.install()
  },
}))
