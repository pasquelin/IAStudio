import { describe, expect, it } from 'vitest'
import { failureKeyOf, failureMessageKey } from './failureMessage'

describe('failure message', () => {
  it('maps a code to its key', () => {
    expect(failureMessageKey('rate-limited')).toBe('errors.rateLimited')
  })

  /**
   * `ipcMain.handle` does not hand a rejection over untouched: it wraps the message. Matching
   * the whole string never fired, and every failure read as "an unexpected error occurred" —
   * which is exactly what the codes exist to avoid.
   */
  it('reads the code out of the message Electron wraps around it', () => {
    const wrapped = new Error(
      "Error invoking remote method 'provider:search-models': Error: rate-limited",
    )

    expect(failureKeyOf(wrapped)).toBe('errors.rateLimited')
  })

  it('reads a bare code too, as it arrives from a store', () => {
    expect(failureKeyOf(new Error('invalid-credentials'))).toBe('errors.invalidCredentials')
  })

  it('falls back to unexpected on anything it cannot place', () => {
    expect(failureKeyOf(new Error('kaboom'))).toBe('errors.unexpected')
    expect(failureKeyOf('kaboom')).toBe('errors.unexpected')
    expect(failureKeyOf(undefined)).toBe('errors.unexpected')
  })
})
