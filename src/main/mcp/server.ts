import { randomBytes } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { APP_NAME } from '@shared/constants'
import { type ActionOutcome, type AssistantCall, refusalKey } from '@shared/domain/assistant'
import { englishText } from '@shared/i18n'
import { log } from '@main/log'
import { admits } from './access'
import { MCP_PATH, type McpEndpoint } from './endpoint'
import { actionOfTool, mcpTools } from './tools'

/**
 * The studio, as a tool a client outside it can reach.
 *
 * Bound to the loopback interface, on a port the operating system picks, behind a token that is
 * new every launch — and off unless the person turned it on. It is a door onto their machine,
 * and every one of those four is what stops it being a door for anyone else.
 *
 * It decides nothing about what may run. A call arrives, `ACTION_REGISTRY` says whether it names
 * an action, and the window in front runs it — which is where the confirmation lives, so an
 * action that spends is asked about on screen no matter which side of the machine asked for it.
 */

export type McpDeps = {
  /** Runs one action in the window in front and answers what it made of it. */
  run: (call: AssistantCall) => Promise<ActionOutcome>
  /** The application's version, as the client sees it. Passed in so this file needs no Electron. */
  version: string
  /** Overridable so a test can pin it; a launch mints its own. */
  token?: string
}

export type RunningMcp = McpEndpoint & { close: () => Promise<void> }

/** 32 bytes of `randomBytes`, hex — the same shape a session token has everywhere else. */
function newToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * The MCP server for one request.
 *
 * Built per request and thrown away with it — the transport's stateless mode. A long-lived
 * session would buy resumability this server has no use for: every call it serves is one round
 * trip that either ran an action or did not.
 */
function protocolServer(run: McpDeps['run'], version: string): Server {
  const server = new Server({ name: APP_NAME, version }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: mcpTools() }))

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const action = actionOfTool(request.params.name)
    // A tool nothing declares. Answered as a tool error rather than a protocol one: the client
    // asked a well-formed question and deserves to hear what was wrong with it.
    if (!action) {
      return {
        isError: true,
        content: [{ type: 'text', text: `No such tool: ${request.params.name}` }],
      }
    }

    const outcome = await run({ action: action.name, input: request.params.arguments ?? {} })

    return outcome.ok
      ? { content: [{ type: 'text', text: JSON.stringify(outcome.data ?? { done: true }) }] }
      : // The refusal in English, from the same bundle line the person read in their own
        // language a second ago. One reason, two renderings.
        {
          isError: true,
          content: [{ type: 'text', text: englishText(refusalKey(outcome.refusal)) }],
        }
  })

  return server
}

async function serveMcp(
  request: IncomingMessage,
  response: ServerResponse,
  deps: McpDeps,
): Promise<void> {
  const server = protocolServer(deps.run, deps.version)
  const transport = new StreamableHTTPServerTransport({
    // Stateless: no session id, and a plain JSON body rather than an SSE stream. What this
    // server does has no progress to stream — an action either ran or was refused.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  response.on('close', () => {
    void transport.close()
    void server.close()
  })

  await server.connect(transport)
  await transport.handleRequest(request, response)
}

function refuse(response: ServerResponse, status: number): void {
  response.writeHead(status).end()
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  deps: McpDeps,
  token: string,
): Promise<void> {
  const verdict = admits(request.headers, token)
  if (verdict !== 'granted') {
    // One status for both refusals, so a caller learns nothing from which of the two it failed —
    // and the log, which only this machine's owner reads, says which.
    log.warn('mcp', `refused a request: ${verdict}`)
    refuse(response, 403)
    return
  }

  // One path, and the URL carries a query string on some clients — compared on the path alone.
  const path = (request.url ?? '').split('?')[0]
  if (path !== MCP_PATH) {
    refuse(response, 404)
    return
  }

  await serveMcp(request, response, deps)
}

function listen(http: HttpServer): Promise<number> {
  return new Promise((resolve, reject) => {
    http.once('error', reject)
    // Port 0 is "whichever is free", and `127.0.0.1` rather than `localhost` or nothing at all:
    // an unbound host listens on every interface, which is the whole machine's network.
    http.listen(0, '127.0.0.1', () => {
      const address = http.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('the MCP server bound no port'))
        return
      }
      resolve(address.port)
    })
  })
}

export async function startMcp(deps: McpDeps): Promise<RunningMcp> {
  const token = deps.token ?? newToken()

  const http = createServer((request, response) => {
    void route(request, response, deps, token).catch(error => {
      log.warn('mcp', `a request failed: ${String(error)}`)
      if (!response.headersSent) refuse(response, 500)
    })
  })

  const port = await listen(http)
  log.info('mcp', `listening on 127.0.0.1:${port}`)

  return {
    port,
    token,
    close: () =>
      new Promise<void>(resolve => {
        // `closeAllConnections` first: a client holding a keep-alive socket would otherwise
        // keep `close` from ever calling back, and the application would not quit.
        http.closeAllConnections()
        http.close(() => resolve())
      }),
  }
}
