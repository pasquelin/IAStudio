import type { McpState } from '@shared/ipc'

/**
 * Where the server is and how to be let in — the two things a client needs and cannot guess.
 *
 * The port is ephemeral and the token is new every launch, so neither can be written down in a
 * document: they are written to `mcp.json` beside the settings, and the preferences offer the
 * one command that carries both.
 */

export type McpEndpoint = { port: number; token: string }

/**
 * What a window may know of it: the port, never the token — invariant 1. Derived HERE so the
 * pull and the push cannot disagree: the rule "no port means nothing is listening" was stated
 * once per producer, and nothing would have reddened the day they drifted.
 */
export const mcpStateOf = (endpoint: McpEndpoint | null): McpState => ({
  port: endpoint?.port ?? null,
})

/**
 * 🛑 What a client is registered UNDER, and it may not hold a space: `APP_NAME` is "IA Studio",
 * so `claude mcp add … ia studio http://…` had the CLI read the name as `ia`, the url as
 * `studio`, and the real url as a stray argument. The JSON block would have named a server
 * "ia studio", which is legal there and inconsistent with the command beside it.
 */
export const clientName = (appName: string): string => appName.toLowerCase().replace(/\s+/g, '-')

/** The single path the server answers on. Anything else is a 404, whoever asks. */
export const MCP_PATH = '/mcp'

/**
 * `127.0.0.1` written out rather than `localhost`: the name resolves to an IPv6 address first on
 * some machines, and the server binds the IPv4 loopback alone.
 */
export function mcpUrl({ port }: McpEndpoint): string {
  return `http://127.0.0.1:${port}${MCP_PATH}`
}

/**
 * What the person pastes into a terminal to point a client here.
 *
 * The token rides in a header rather than in the URL: a URL is what ends up in shell history,
 * in a screenshot of a config file, and in the client's own logs.
 */
export function mcpAddCommand(endpoint: McpEndpoint, name: string): string {
  return [
    'claude mcp add --transport http',
    name,
    mcpUrl(endpoint),
    `--header "Authorization: Bearer ${endpoint.token}"`,
  ].join(' ')
}

/**
 * The same two facts in the shape a client that reads a FILE takes them — measured against what
 * `claude mcp add` itself writes: an `mcpServers` map of `{ type, url, headers }`.
 *
 * Beside the command rather than instead of it: one covers a client driven from a terminal, the
 * other every client configured by a file, and nothing here can know which one is on the machine.
 */
export function mcpConfigJson(endpoint: McpEndpoint, name: string): string {
  return `${JSON.stringify(
    {
      mcpServers: {
        [name]: {
          type: 'http',
          url: mcpUrl(endpoint),
          headers: { Authorization: `Bearer ${endpoint.token}` },
        },
      },
    },
    null,
    2,
  )}\n`
}
