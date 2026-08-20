import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from '@/stores/settings'
import * as documentIo from '@/app/documentIo'
import { AUTOSAVE_INTERVAL_MS, useAutosave } from './useAutosave'

/**
 * The pass itself is covered by `documentIo.test.ts`; what is only here is the SCHEDULE — that
 * a slow pass is never started twice, and that turning the setting off stops the clock.
 */
describe('useAutosave', () => {
  const setEnabled = (autosave: boolean): void => {
    useSettings.setState(state => ({
      settings: { ...state.settings, general: { ...state.settings.general, autosave } },
    }))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    setEnabled(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('writes once the gap has passed, and not before', async () => {
    const pass = vi.spyOn(documentIo, 'autosaveOpenDocuments').mockResolvedValue()
    renderHook(() => useAutosave())

    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1)
    expect(pass).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(pass).toHaveBeenCalledTimes(1)
  })

  // The whole reason this hook is not three lines: an interval would have started the second
  // pass while the first was still reading editors back.
  it('never starts a pass on top of one still running', async () => {
    let release = (): void => {}
    const pass = vi
      .spyOn(documentIo, 'autosaveOpenDocuments')
      .mockImplementation(() => new Promise(resolve => (release = () => resolve())))
    renderHook(() => useAutosave())

    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 3)
    expect(pass).toHaveBeenCalledTimes(1)

    release()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    expect(pass).toHaveBeenCalledTimes(2)
  })

  it('stops writing when the setting is turned off', async () => {
    const pass = vi.spyOn(documentIo, 'autosaveOpenDocuments').mockResolvedValue()
    const { rerender } = renderHook(() => useAutosave())

    setEnabled(false)
    rerender()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2)

    expect(pass).not.toHaveBeenCalled()
  })

  // A pass that rejects must not stop the clock: the disk being full for a minute is exactly
  // when the net is worth having.
  it('keeps its schedule when a pass fails', async () => {
    const pass = vi
      .spyOn(documentIo, 'autosaveOpenDocuments')
      .mockRejectedValueOnce(new Error('no space'))
      .mockResolvedValue()
    renderHook(() => useAutosave())

    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS)

    expect(pass).toHaveBeenCalledTimes(2)
  })
})
