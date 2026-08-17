import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { defaultAt, partialFor, valueAt } from './settingsPath'

describe('settings paths', () => {
  it('reads a leaf through its path', () => {
    expect(valueAt(DEFAULT_SETTINGS, 'appearance.theme')).toBe('dark')
    expect(valueAt(DEFAULT_SETTINGS, 'generation.concurrentJobs')).toBe(3)
  })

  it('reads an unset optional leaf as absent rather than as an empty value', () => {
    expect(valueAt(DEFAULT_SETTINGS, 'media.ffmpegPath')).toBeUndefined()
  })

  it('takes the defaults from one place, so nothing restates what a setting starts at', () => {
    expect(defaultAt('appearance.density')).toBe(DEFAULT_SETTINGS.appearance.density)
  })

  it('turns a path and a value into the partial the boundary takes', () => {
    expect(partialFor('appearance.theme', 'light')).toEqual({ appearance: { theme: 'light' } })
  })

  // Unsetting is what tells ffmpeg to fall back to the bundled binary, then to the PATH.
  it('carries an unset value rather than dropping the key', () => {
    expect(partialFor('media.ffmpegPath', undefined)).toEqual({ media: { ffmpegPath: undefined } })
  })

  it('touches nothing but the leaf it names', () => {
    expect(partialFor('generation.maxRetries', 7)).toEqual({ generation: { maxRetries: 7 } })
  })
})
