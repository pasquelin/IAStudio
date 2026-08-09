import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { partialFor, type SettingValue } from '@shared/domain/settings-path'
import {
  optionsOf,
  SETTING_REGISTRY,
  type SettingDescriptor,
} from '@shared/domain/settings-registry'
import { parsePartialSettings, salvagePartialSettings } from './validation'

/** A value the descriptor itself says is acceptable — no second table of examples to maintain. */
function acceptable(descriptor: SettingDescriptor): SettingValue {
  switch (descriptor.kind) {
    case 'boolean':
      return true
    case 'choice':
      return optionsOf(descriptor)[0]?.value ?? ''
    case 'color':
      return '#3574f0'
    case 'number':
    case 'slider':
      return descriptor.min ?? 1
    default:
      return '/some/path'
  }
}

describe('settings validation', () => {
  /*
   * The shape is enumerated by hand in `validation.ts`, and zod STRIPS what it does not declare
   * rather than refusing it. A branch added to `Settings` and forgotten there would therefore
   * seem to save and be gone on the next launch — the worst of the two failures, because
   * nothing reports it. Driven from the registry so this needs no upkeep of its own.
   */
  it('keeps every setting the registry describes, so none is silently stripped on write', () => {
    for (const descriptor of SETTING_REGISTRY) {
      const written = partialFor(descriptor.path, acceptable(descriptor))
      expect(parsePartialSettings(written), `${descriptor.path} is stripped on write`).toEqual(
        written,
      )
    }
  })

  it('keeps every branch of the defaults, which is what a fresh install writes back', () => {
    expect(parsePartialSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })

  it('accepts a partial and keeps only the sections it declares', () => {
    expect(parsePartialSettings({ appearance: { density: 'compact' } })).toEqual({
      appearance: { density: 'compact' },
    })
  })

  it('drops keys the contract does not declare', () => {
    expect(parsePartialSettings({ appearance: { density: 'compact', zoom: 3 } })).toEqual({
      appearance: { density: 'compact' },
    })
  })

  it('rejects a value outside the declared union', () => {
    expect(() => parsePartialSettings({ appearance: { theme: 'purple' } })).toThrow()
  })

  it('rejects a job concurrency the semaphore could not honour', () => {
    expect(() => parsePartialSettings({ generation: { concurrentJobs: 0 } })).toThrow()
    expect(() => parsePartialSettings({ generation: { concurrentJobs: 999 } })).toThrow()
    expect(() => parsePartialSettings({ generation: { concurrentJobs: 2.5 } })).toThrow()
  })

  it('accepts a path to ffmpeg, which it never checks for existence', () => {
    // The binary may be plugged in later; `resolveFfmpeg` falls through to the PATH meanwhile.
    expect(parsePartialSettings({ media: { ffmpegPath: '/nowhere/yet/ffmpeg' } })).toEqual({
      media: { ffmpegPath: '/nowhere/yet/ffmpeg' },
    })
  })

  it('rejects an ffmpeg path that is not a usable string', () => {
    expect(() => parsePartialSettings({ media: { ffmpegPath: '' } })).toThrow()
    expect(() => parsePartialSettings({ media: { ffmpegPath: 42 } })).toThrow()
  })

  it('rejects anything that is not an object', () => {
    expect(() => parsePartialSettings('compact')).toThrow()
    expect(() => parsePartialSettings(null)).toThrow()
  })

  it('salvages a hand-edited config file into the defaults instead of throwing', () => {
    expect(salvagePartialSettings({ appearance: { theme: 'purple' } })).toEqual({})
    expect(salvagePartialSettings('garbage')).toEqual({})
    expect(salvagePartialSettings(undefined)).toEqual({})
  })

  it('salvages a valid stored partial unchanged', () => {
    expect(salvagePartialSettings({ storage: { backend: 'cloud' } })).toEqual({
      storage: { backend: 'cloud' },
    })
  })
})

/**
 * The bar order is the one branch a stale or hand-edited file is likely to carry wrong, since
 * it is written by a gesture rather than typed into a screen. Before it existed, an unknown key
 * was simply stripped — it must not become the key that costs the file.
 */
describe('salvaging the bar order', () => {
  const withTheme = (workspaces: unknown): unknown => ({
    workspaces,
    appearance: { theme: 'light' },
  })

  it('drops a space this build no longer knows, keeping the rest of the order', () => {
    const salvaged = salvagePartialSettings(withTheme({ order: ['image', 'nether', 'audio'] }))

    expect(salvaged.workspaces?.order).toEqual(['image', 'audio'])
    expect(salvaged.appearance?.theme).toBe('light')
  })

  it('keeps the other settings when the order is not a list at all', () => {
    expect(salvagePartialSettings(withTheme({ order: 'image' })).appearance?.theme).toBe('light')
  })

  it('keeps the other settings when the branch itself is not an object', () => {
    expect(salvagePartialSettings(withTheme(['image', 'audio'])).appearance?.theme).toBe('light')
  })

  // A written order is always a reconciled one, so it can never legitimately outgrow the
  // registry — a longer list is a file to distrust, not a list to keep in memory and rewrite.
  it('refuses an order longer than the registry, and only the order', () => {
    const long = Array.from({ length: 10_000 }, () => 'image')

    const salvaged = salvagePartialSettings(withTheme({ order: long }))

    expect(salvaged.workspaces?.order ?? []).toEqual([])
    expect(salvaged.appearance?.theme).toBe('light')
  })
})
