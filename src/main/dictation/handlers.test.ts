import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerDictationHandlers } from './handlers'
import type { DictationSession } from './session'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

function register(overrides: Partial<DictationSession> = {}) {
  const session: DictationSession = {
    snapshot: () => ({ state: 'ready', download: null, failure: null }),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
    push: vi.fn(),
    downloadModel: vi.fn(() => Promise.resolve()),
    cancelDownload: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  }
  const openPrivacySettings = vi.fn()

  registerDictationHandlers({ session, openPrivacySettings })
  return { session, openPrivacySettings }
}

const chunkOf = (samples: number[]): ArrayBuffer => Int16Array.from(samples).buffer

describe('the dictation channels', () => {
  beforeEach(resetHandlers)

  it('answers the state as it stands', async () => {
    register()

    expect(await invoke(CHANNELS.dictationState)).toEqual({
      state: 'ready',
      download: null,
      failure: null,
    })
  })

  it('starts, stops and cancels a session', async () => {
    const { session } = register()

    await invoke(CHANNELS.dictationStart)
    await invoke(CHANNELS.dictationStop)
    await invoke(CHANNELS.dictationCancel)

    expect(session.start).toHaveBeenCalled()
    expect(session.stop).toHaveBeenCalled()
    expect(session.cancel).toHaveBeenCalled()
  })

  it('passes a chunk of audio through as samples', async () => {
    const { session } = register()

    await invoke(CHANNELS.dictationPush, chunkOf([1, -1, 32_767]))

    expect(session.push).toHaveBeenCalledWith(new Int16Array([1, -1, 32_767]))
  })

  // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer. A
  // refusal is silent rather than thrown: nothing awaits this, so a throw would settle a
  // promise nobody reads while the microphone keeps running.
  it('drops what is not audio, rather than refusing out loud', async () => {
    const { session } = register()

    await invoke(CHANNELS.dictationPush, 'not audio at all')
    await invoke(CHANNELS.dictationPush, new ArrayBuffer(0))

    expect(session.push).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(session.push).mock.calls) expect(call[0]).toHaveLength(0)
  })

  // The one channel a compromised window could flood: a minute of audio in one message would
  // be held whole, and the engine would work through it while the user waited.
  it('drops a chunk far longer than the capture ever sends', async () => {
    const { session } = register()

    await invoke(CHANNELS.dictationPush, new ArrayBuffer(1_600 * 2 * 60))

    expect(session.push).toHaveBeenCalledWith(new Int16Array(0))
  })

  it('fetches the model and stops fetching it', async () => {
    const { session } = register()

    await invoke(CHANNELS.dictationDownloadModel)
    await invoke(CHANNELS.dictationCancelDownload)

    expect(session.downloadModel).toHaveBeenCalled()
    expect(session.cancelDownload).toHaveBeenCalled()
  })

  // No address crosses the boundary: a renderer that could name what gets opened would be a
  // renderer that can open anything.
  it('opens the privacy screen without being told which one', async () => {
    const { openPrivacySettings } = register()

    await invoke(CHANNELS.dictationOpenPrivacy)

    expect(openPrivacySettings).toHaveBeenCalledWith()
  })
})
