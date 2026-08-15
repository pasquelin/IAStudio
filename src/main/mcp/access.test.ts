import { describe, expect, it } from 'vitest'
import { admits } from './access'

const TOKEN = 'a'.repeat(64)
const authorised = { authorization: `Bearer ${TOKEN}` }

describe('who the MCP server serves', () => {
  it('serves a caller carrying the token and no origin at all', () => {
    // A command-line client sends none. Refusing that would refuse every real use there is.
    expect(admits(authorised, TOKEN)).toBe('granted')
  })

  it('serves a page on the loopback interface, under either spelling', () => {
    expect(admits({ ...authorised, origin: 'http://localhost:5173' }, TOKEN)).toBe('granted')
    expect(admits({ ...authorised, origin: 'http://127.0.0.1:9999' }, TOKEN)).toBe('granted')
  })

  /** DNS rebinding: a site that resolved its own name here would arrive with its own origin. */
  it('refuses a page from anywhere else, token or no token', () => {
    expect(admits({ ...authorised, origin: 'https://elsewhere.example' }, TOKEN)).toBe('badOrigin')
  })

  it('refuses a caller with no token, a wrong one, or the wrong scheme', () => {
    expect(admits({}, TOKEN)).toBe('badToken')
    expect(admits({ authorization: `Bearer ${'b'.repeat(64)}` }, TOKEN)).toBe('badToken')
    expect(admits({ authorization: TOKEN }, TOKEN)).toBe('badToken')
  })

  /**
   * Node folds repeated headers into an array, and picking one of two `Authorization` values
   * would be guessing at which the caller meant.
   */
  it('refuses a caller that sent the header twice', () => {
    expect(admits({ authorization: [`Bearer ${TOKEN}`, 'Bearer nope'] }, TOKEN)).toBe('badToken')
  })
})
