import { describe, expect, it, vi } from 'vitest'
import type { AiOverview } from '@shared/domain/aiOverview'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from './aiModels'

const overview = (over: Partial<AiOverview> = {}): AiOverview => ({
  roles: [],
  machine: { physicalBytes: 0, availableBytes: 0, diskFreeBytes: null, gpu: null, vram: null },
  projectPath: null,
  installing: null,
  loading: null,
  loadFailure: null,
  ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
  ...over,
})

describe('the AI manager store', () => {
  it('reads what the main process holds, then follows what it pushes', async () => {
    let push: ((next: AiOverview) => void) | undefined
    installFakeBridge({
      ai: {
        overview: () => Promise.resolve(overview({ projectPath: '/read' })),
        onChanged: callback => {
          push = callback
          return () => {}
        },
      },
    })

    const stop = await useAiModels.getState().connect()
    expect(useAiModels.getState().overview?.projectPath).toBe('/read')

    push?.(overview({ projectPath: '/pushed' }))
    expect(useAiModels.getState().overview?.projectPath).toBe('/pushed')

    stop()
  })

  /**
   * An install running while this window opens publishes its progress on the event channel, and
   * the snapshot asked for first answers with the state from before it.
   */
  it('lets a change that landed first stand, rather than the snapshot in flight', async () => {
    let push: ((next: AiOverview) => void) | undefined
    installFakeBridge({
      ai: {
        overview: () =>
          // Answers only once the push above has landed, which is the order this guards.
          Promise.resolve().then(() => overview({ projectPath: '/stale' })),
        onChanged: callback => {
          push = callback
          return () => {}
        },
      },
    })

    const joining = useAiModels.getState().connect()
    push?.(overview({ projectPath: '/fresh' }))
    await joining

    expect(useAiModels.getState().overview?.projectPath).toBe('/fresh')
  })

  // Every command answers with the whole overview: none of them has a reply of its own, so none
  // of them needs a second round trip to say what changed.
  it('takes the overview a command answered with', async () => {
    const install = vi.fn(() => Promise.resolve(overview({ projectPath: '/installed' })))
    installFakeBridge({ ai: { install } })

    await useAiModels.getState().installAiModel('parakeet')

    expect(install).toHaveBeenCalledWith('parakeet')
    expect(useAiModels.getState().overview?.projectPath).toBe('/installed')
  })

  // The subscription holds, so a failed snapshot must not blank the screen: the next change the
  // main process pushes fills it in.
  it('keeps what it had when the main process could not answer', async () => {
    installFakeBridge({ ai: { overview: () => Promise.reject(new Error('no')) } })
    useAiModels.setState({ overview: overview({ projectPath: '/held' }) })

    await useAiModels.getState().connect()

    expect(useAiModels.getState().overview?.projectPath).toBe('/held')
  })
})
