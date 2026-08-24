import { describe, expect, it } from 'vitest'
import { APP_NAME } from '@shared/constants'
import { clientName, mcpAddCommand, mcpConfigJson, mcpUrl } from './endpoint'

const endpoint = { port: 54_321, token: 'abcdef' }

describe('pointing a client here', () => {
  /**
   * 🛑 Against `APP_NAME` itself rather than a fixture: it is "IA Studio", and the space in it
   * made `claude mcp add … ia studio http://…` read the name as `ia` and the url as `studio`.
   * A test naming its own client cannot see that.
   */
  it('registers the studio under a name with no space in it', () => {
    expect(clientName(APP_NAME)).toBe('ia-studio')
    expect(mcpAddCommand(endpoint, clientName(APP_NAME)).split(' ')).toContain('ia-studio')
  })

  /**
   * The loopback IPv4 written out, and the one path the server answers on. A client sent to
   * `localhost` reaches the IPv6 address first on some machines, where nothing is bound.
   */
  it('names the loopback and the one path', () => {
    expect(mcpUrl(endpoint)).toBe('http://127.0.0.1:54321/mcp')
  })

  /** The token rides in a HEADER: a URL ends up in shell history and in the client's own logs. */
  it('puts the token in a header, never in the url', () => {
    const command = mcpAddCommand(endpoint, 'ia-studio')

    expect(command).toContain('--header "Authorization: Bearer abcdef"')
    expect(command).toContain('http://127.0.0.1:54321/mcp')
  })

  /**
   * The shape measured against what `claude mcp add` itself writes — an `mcpServers` map of
   * `{ type, url, headers }`. Parsed rather than compared as text: what a client reads is the
   * JSON, and a trailing comma would pass a substring check and fail every client on the machine.
   */
  it('hands a file-driven client the same connection, as JSON it can parse', () => {
    const parsed: unknown = JSON.parse(mcpConfigJson(endpoint, 'ia-studio'))

    expect(parsed).toEqual({
      mcpServers: {
        'ia-studio': {
          type: 'http',
          url: 'http://127.0.0.1:54321/mcp',
          headers: { Authorization: 'Bearer abcdef' },
        },
      },
    })
  })
})
