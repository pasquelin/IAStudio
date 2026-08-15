/**
 * Where the server is and how to be let in — the two things a client needs and cannot guess.
 *
 * The port is ephemeral and the token is new every launch, so neither can be written down in a
 * document: they are written to `mcp.json` beside the settings, and the preferences offer the
 * one command that carries both.
 */

export type McpEndpoint = { port: number; token: string }

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
