import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { APP_NAME } from '@shared/constants'
import { isRecord } from '@shared/guards'
import { isMissing } from '@main/persistence'
import { mcpEndpointOf, mcpUrl, type McpEndpoint } from './endpoint'

/**
 * The studio as a command a client SPAWNS, rather than a URL it has to be handed.
 *
 * A port that was whichever was free and a token new every launch made a client's configuration
 * die at the next start. Here it holds neither: every message is carried to whatever address the
 * studio is answering on at that moment, and none of the four guards moves.
 */

export type StdioDeps = {
  input: NodeJS.ReadableStream
  output: NodeJS.WritableStream
  /** Never `output`: one line that is not JSON-RPC there and the client can read nothing after. */
  report: (line: string) => void
  /** Where a running studio wrote its port and token. Read per message, never held. */
  endpointPath: string
}

/** Reserved for implementation-defined server errors, which is what a shut door is here. */
const NOT_ANSWERING = -32_001

const SHUT = `${APP_NAME} is not answering: it is not running, or its way in is switched off.`

async function endpointAt(path: string, report: StdioDeps['report']): Promise<McpEndpoint | null> {
  try {
    return mcpEndpointOf(await readFile(path, 'utf8'))
  } catch (error) {
    // No file is the ordinary state and says itself. Anything else — a permission, a truncated
    // file — reads as "not running" to the client, so it is the only place it can be named.
    if (!isMissing(error)) report(`could not read the address: ${String(error)}`)
    return null
  }
}

/** Nothing at all for a notification: it carries no id, so there is no answer to address. */
function refusal(id: unknown): string | null {
  return id === undefined || id === null
    ? null
    : JSON.stringify({ jsonrpc: '2.0', id, error: { code: NOT_ANSWERING, message: SHUT } })
}

/** The body is the line as it arrived: re-spelling two programs' JSON is a way to change it. */
async function carry(line: string, deps: StdioDeps): Promise<string | null> {
  const endpoint = await endpointAt(deps.endpointPath, deps.report)
  if (endpoint === null) return null

  const response = await fetch(mcpUrl(endpoint), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Both, as the Streamable HTTP transport requires of a client.
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${endpoint.token}`,
    },
    body: line,
  })

  const body = (await response.text()).trim()
  if (!response.ok) {
    // Our own 403 and 404 answer with nothing, so the client would hear "not running" for a stale
    // token — the one cause a person can act on, and the only place it can be named.
    deps.report(`the address answered HTTP ${response.status}`)
    return null
  }

  /**
   * 🛑 A newline splits one answer into two messages on the client's stream and desynchronises
   * its parser for good. Nothing this server writes holds one, so a body that does came from
   * something else — a crash left an address the operating system had since given away.
   *
   * The blind spot, since it cannot be closed here: the token was already offered to whatever
   * holds that port, one message before this could tell.
   */
  if (body.includes('\n')) {
    deps.report('the address answered something that is not one JSON-RPC message')
    return null
  }

  // A notification is answered 202 with nothing in it, and an empty line would be a message the
  // client has to fail to parse.
  return body === '' ? null : body
}

async function answer(line: string, deps: StdioDeps): Promise<void> {
  let id: unknown
  try {
    const message: unknown = JSON.parse(line)
    id = isRecord(message) ? message['id'] : undefined
  } catch {
    // Not ours to answer: something other than JSON carries no id to address a refusal to.
    deps.report('a line that was not JSON reached the way in, and was dropped')
    return
  }

  let carried: string | null
  try {
    carried = await carry(line, deps)
  } catch (error) {
    // A file naming a port nothing holds any more is the same answer as no file at all.
    deps.report(`could not reach the studio: ${String(error)}`)
    carried = null
  }

  const written = carried ?? refusal(id)
  if (written !== null) deps.output.write(`${written}\n`)
}

/**
 * Carries a client's messages for as long as it holds the pipe open.
 *
 * Answered CONCURRENTLY, which is not a refinement: an action that puts a question on screen may
 * stand for two minutes, and a client that pipelines would have every later call queued behind
 * it. The server is stateless per request, so nothing depends on their order.
 */
export async function runStdioBridge(deps: StdioDeps): Promise<void> {
  // A client that goes away mid-answer breaks the pipe, and an unhandled `error` event on a
  // stream ends the process rather than the conversation.
  deps.output.on('error', error => deps.report(`could not answer: ${String(error)}`))

  const carried: Promise<void>[] = []

  for await (const line of createInterface({ input: deps.input })) {
    if (line.trim() !== '') carried.push(answer(line, deps))
  }

  // A client that closes its end right after its last message would otherwise lose that answer.
  await Promise.all(carried)
}
