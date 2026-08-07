import { describe, expect, it } from 'vitest'
import { parsePartialSettings, salvagePartialSettings } from './validation'

describe('settings validation', () => {
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
