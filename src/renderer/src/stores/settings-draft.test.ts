import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useSettings } from './settings'
import { isSettingsDraftDirty, useSettingsDraft, valueOf } from './settings-draft'

const draft = () => useSettingsDraft.getState()

beforeEach(() => {
  useSettingsDraft.setState({ pending: {}, touched: new Set() })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
})

describe('staging a change', () => {
  it('writes nothing until it is applied', () => {
    const write = vi.fn(() => Promise.resolve())
    useSettings.setState({ write })

    draft().stage('appearance.density', 'compact')

    expect(write).not.toHaveBeenCalled()
    expect(isSettingsDraftDirty(draft())).toBe(true)
  })

  it('accumulates several leaves into one write', async () => {
    const write = vi.fn(() => Promise.resolve())
    useSettings.setState({ write })

    draft().stage('appearance.density', 'compact')
    draft().stage('appearance.theme', 'light')
    draft().stage('generation.maxRetries', 2)
    await draft().apply()

    // One write, one disk touch, one broadcast — rather than three.
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith({
      appearance: { density: 'compact', theme: 'light' },
      generation: { maxRetries: 2 },
    })
  })

  it('empties itself once applied, so nothing stays marked as waiting', async () => {
    useSettings.setState({ write: () => Promise.resolve() })

    draft().stage('appearance.density', 'compact')
    await draft().apply()

    expect(isSettingsDraftDirty(draft())).toBe(false)
  })

  it('drops everything on cancel, without writing', async () => {
    const write = vi.fn(() => Promise.resolve())
    useSettings.setState({ write })

    draft().stage('appearance.density', 'compact')
    draft().cancel()
    await draft().apply()

    expect(write).not.toHaveBeenCalled()
    expect(isSettingsDraftDirty(draft())).toBe(false)
  })

  // A value put back by hand is still a change until it is applied; losing the mark halfway
  // would leave the row looking settled while the buffer still holds it.
  it('keeps a leaf marked even when put back to what it was', () => {
    draft().stage('appearance.density', 'compact')
    draft().stage('appearance.density', 'comfortable')

    expect(isSettingsDraftDirty(draft())).toBe(true)
  })

  it('stages what no path can express, such as a family default model', async () => {
    const write = vi.fn(() => Promise.resolve())
    useSettings.setState({ write })

    draft().stageBranch({ generation: { defaultModels: { image: 'model_1' } } })
    draft().stage('generation.maxRetries', 2)
    await draft().apply()

    expect(write).toHaveBeenCalledWith({
      generation: { defaultModels: { image: 'model_1' }, maxRetries: 2 },
    })
  })
})

describe('what a control shows', () => {
  it('shows the staged value where one was staged', () => {
    draft().stage('appearance.density', 'compact')

    expect(valueOf(draft(), 'comfortable', 'appearance.density')).toBe('compact')
  })

  /*
   * The collision rule with the other windows. A write landing from elsewhere moves the stored
   * settings underneath; the buffer must win on what it holds and lose on everything else,
   * which is the same rule a single text field already followed.
   */
  it('shows what another window wrote on a leaf it never touched', () => {
    draft().stage('appearance.density', 'compact')

    expect(valueOf(draft(), 'light', 'appearance.theme')).toBe('light')
  })

  it('shows a staged value that was deliberately unset', () => {
    draft().stage('media.ffmpegPath', undefined)

    expect(valueOf(draft(), '/usr/bin/ffmpeg', 'media.ffmpegPath')).toBeUndefined()
  })
})

describe('whether anything is waiting', () => {
  it('counts a branch staged by a bespoke screen, not only touched leaves', () => {
    draft().stageBranch({ generation: { defaultModels: { image: 'model_1' } } })

    // Without this the default-model screen stages a change and no Apply button appears.
    expect(isSettingsDraftDirty(draft())).toBe(true)
  })

  it('is quiet on a fresh buffer, so the window is not a form with nothing to submit', () => {
    expect(isSettingsDraftDirty(draft())).toBe(false)
  })
})
