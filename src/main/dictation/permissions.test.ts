import { describe, expect, it, vi } from 'vitest'
import { requestMicrophone, type MicrophoneHost } from './permissions'

const host = (overrides: Partial<MicrophoneHost> = {}): MicrophoneHost => ({
  platform: 'darwin',
  status: () => 'not-determined',
  ask: () => Promise.resolve(true),
  ...overrides,
})

describe('requestMicrophone', () => {
  it('prompts when nothing has been decided yet, and reports what was chosen', async () => {
    const ask = vi.fn(() => Promise.resolve(true))
    expect(await requestMicrophone(host({ ask }))).toBe('granted')
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('reports a refusal at the prompt', async () => {
    expect(await requestMicrophone(host({ ask: () => Promise.resolve(false) }))).toBe('denied')
  })

  it('does not prompt again once granted', async () => {
    const ask = vi.fn(() => Promise.resolve(true))
    expect(await requestMicrophone(host({ status: () => 'granted', ask }))).toBe('granted')
    expect(ask).not.toHaveBeenCalled()
  })

  // macOS never shows the prompt twice: asking again resolves false without a dialog, which
  // would read as a fresh refusal instead of one the user has to undo in the system settings.
  it('does not prompt again once denied', async () => {
    const ask = vi.fn(() => Promise.resolve(false))
    expect(await requestMicrophone(host({ status: () => 'denied', ask }))).toBe('denied')
    expect(ask).not.toHaveBeenCalled()
  })

  it('treats a restricted machine as a refusal, since nothing here can lift it', async () => {
    expect(await requestMicrophone(host({ status: () => 'restricted' }))).toBe('denied')
  })

  // Windows and Linux have no equivalent call: the answer only comes from `getUserMedia`, and
  // claiming to know it beforehand would be inventing one.
  it('answers unknown off macOS rather than guessing', async () => {
    const ask = vi.fn(() => Promise.resolve(true))
    expect(await requestMicrophone(host({ platform: 'win32', ask }))).toBe('unknown')
    expect(ask).not.toHaveBeenCalled()
  })
})
