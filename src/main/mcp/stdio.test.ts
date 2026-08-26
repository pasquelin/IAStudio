import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PassThrough } from 'node:stream'
import { createInterface } from 'node:readline'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionOutcome, AssistantCall } from '@shared/domain/assistant'
import { mcpEndpointJson } from './endpoint'
import { startMcp, type RunningMcp } from './server'
import { runStdioBridge } from './stdio'

/**
 * Driven over a real socket and a real file, like `server.test.ts` and for the same reason: what
 * this file is about is a client that was never told an address, and a bridge that reached its
 * own held copy of one would be green on the very defect it exists to prevent.
 */

let folder = ''
const started: RunningMcp[] = []
const strangers: Server[] = []

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'scenario-stdio-'))
})

afterEach(async () => {
  for (const server of started.splice(0)) await server.close()
  for (const stranger of strangers.splice(0))
    await new Promise<void>(resolve => stranger.close(() => resolve()))
  await rm(folder, { recursive: true, force: true })
})

const endpointPath = (): string => join(folder, 'mcp.json')

async function studioListening(
  run: (call: AssistantCall) => Promise<ActionOutcome> = () => Promise.resolve({ ok: true }),
): Promise<RunningMcp> {
  const server = await startMcp({ run, version: '1.2.3' })
  started.push(server)
  await writeFile(endpointPath(), mcpEndpointJson(server))
  return server
}

type Client = {
  send: (message: unknown) => void
  sendRaw: (line: string) => void
  answer: () => Promise<Record<string, unknown>>
  close: () => void
  reported: string[]
}

function clientTalking(): Client {
  const toStudio = new PassThrough()
  const fromStudio = new PassThrough()
  const reported: string[] = []

  void runStdioBridge({
    input: toStudio,
    output: fromStudio,
    report: line => reported.push(line),
    endpointPath: endpointPath(),
  })

  const answers = createInterface({ input: fromStudio })[Symbol.asyncIterator]()

  return {
    send: message => toStudio.write(`${JSON.stringify(message)}\n`),
    sendRaw: line => toStudio.write(`${line}\n`),
    answer: async () =>
      JSON.parse((await answers.next()).value as string) as Record<string, unknown>,
    close: () => toStudio.end(),
    reported,
  }
}

const call = (id: number, name: string, args: Record<string, unknown> = {}): unknown => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name, arguments: args },
})

describe('the studio as a command a client spawns', () => {
  it('carries a call to the studio and hands back what it answered', async () => {
    const run = vi.fn<(call: AssistantCall) => Promise<ActionOutcome>>(() =>
      Promise.resolve({ ok: true, data: { opened: '3d' } }),
    )
    await studioListening(run)
    const client = clientTalking()

    client.send(call(1, 'workspace_open', { workspace: '3d' }))
    const answered = await client.answer()

    expect(run).toHaveBeenCalledWith({ action: 'workspace.open', input: { workspace: '3d' } })
    expect(answered).toMatchObject({
      id: 1,
      result: { content: [{ type: 'text', text: '{"opened":"3d"}' }] },
    })
    client.close()
  })

  /**
   * 🛑 The whole reason this exists. The port is whichever was free and the token is new every
   * launch, so a client holding either had to be reconfigured at every start of the studio — and
   * `electron-vite --watch` restarts the main process several times an hour.
   *
   * The address is re-read PER MESSAGE, never held: a bridge that read it once would answer the
   * first call and every later one into a dead socket, with nothing red anywhere.
   */
  it('follows the studio to a new port and a new token, with the client told nothing', async () => {
    const first = await studioListening()
    const client = clientTalking()

    client.send(call(1, 'workspace_open', { workspace: '3d' }))
    expect(await client.answer()).toMatchObject({ id: 1 })

    await first.close()
    const second = await studioListening()

    expect(second.port).not.toBe(first.port)
    expect(second.token).not.toBe(first.token)

    client.send(call(2, 'workspace_open', { workspace: 'image' }))
    expect(await client.answer()).toMatchObject({ id: 2, result: {} })
    client.close()
  })

  /**
   * Answered rather than left hanging: a client whose call never comes back reports a timeout,
   * which says nothing about what to do. The studio being shut is the ordinary state.
   */
  it('says the studio is not answering rather than leaving the client waiting', async () => {
    const client = clientTalking()

    client.send(call(1, 'workspace_open', { workspace: '3d' }))
    const answered = await client.answer()

    expect(answered).toMatchObject({ id: 1, error: { code: -32_001 } })
    // The ordinary state, so nothing is reported: only a cause a person could act on is.
    expect(client.reported).toEqual([])
    client.close()
  })

  /** A file naming a port nothing holds any more is the same answer as no file at all. */
  it('answers the same when the address it holds is dead', async () => {
    const server = await studioListening()
    await server.close()
    const client = clientTalking()

    client.send(call(1, 'workspace_open', { workspace: '3d' }))

    expect(await client.answer()).toMatchObject({ id: 1, error: { code: -32_001 } })
    expect(client.reported.join(' ')).toContain('could not reach the studio')
    client.close()
  })

  /**
   * A notification carries no id, so there is nothing to address an answer to — and the server
   * returns an empty body for one. Writing a line for it would be a message the client has to
   * fail to parse, on the stream every later answer travels.
   */
  it('writes nothing at all for a notification', async () => {
    await studioListening()
    const client = clientTalking()

    client.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    client.send(call(1, 'workspace_open', { workspace: '3d' }))

    // The first thing on the stream is the answer to the CALL: nothing was written in between.
    expect(await client.answer()).toMatchObject({ id: 1 })
    client.close()
  })

  /**
   * `carryOneClient` calls `app.exit(0)` the moment this promise resolves, so an answer still in
   * flight then is an answer the client never receives — which is every answer, driven by a pipe.
   */
  it('answers what it took in before it finishes', async () => {
    await studioListening()
    const toStudio = new PassThrough()
    const fromStudio = new PassThrough()

    const finished = runStdioBridge({
      input: toStudio,
      output: fromStudio,
      report: () => {},
      endpointPath: endpointPath(),
    })

    toStudio.write(`${JSON.stringify(call(1, 'workspace_open', { workspace: '3d' }))}\n`)
    toStudio.end()
    await finished

    // Read off the buffer rather than a `data` listener, which fires a tick late and would pass
    // on a bridge that let go too early.
    expect(fromStudio.readableLength).toBeGreaterThan(0)
  })

  /**
   * A stale token — a file left by a crash, a studio restarted since — is answered 403 with an
   * empty body, which read alone is indistinguishable from "nothing is listening".
   */
  it('names the status when the address answers but refuses', async () => {
    const server = await studioListening()
    await writeFile(endpointPath(), mcpEndpointJson({ port: server.port, token: 'a'.repeat(64) }))
    const client = clientTalking()

    client.send(call(1, 'workspace_open', { workspace: '3d' }))

    expect(await client.answer()).toMatchObject({ id: 1, error: { code: -32_001 } })
    expect(client.reported.join(' ')).toContain('HTTP 403')
    client.close()
  })

  /**
   * 🛑 A crash leaves an address, and the operating system gives that port to something else. Its
   * answer — an error page, typically — carries newlines, and a newline on the client's stream
   * splits one message into two and desynchronises its parser for the rest of the session.
   */
  it('never writes an answer that came from something other than the studio', async () => {
    const stranger = createServer((_request, response) =>
      response.writeHead(200).end('<html>\n<body>not the studio</body>\n</html>'),
    )
    await new Promise<void>(resolve => stranger.listen(0, '127.0.0.1', resolve))
    strangers.push(stranger)
    const port = (stranger.address() as AddressInfo).port
    await writeFile(endpointPath(), mcpEndpointJson({ port, token: 'a'.repeat(64) }))
    const client = clientTalking()

    client.send(call(1, 'workspace_open', { workspace: '3d' }))

    expect(await client.answer()).toMatchObject({ id: 1, error: { code: -32_001 } })
    expect(client.reported.join(' ')).toContain('not one JSON-RPC message')
    client.close()
  })

  /**
   * The client's stream carries JSON-RPC and nothing else. A line of ours on it — a log, a
   * warning, a note about a message we could not read — and the client can read none of it.
   */
  it('keeps trouble off the client’s stream', async () => {
    await studioListening()
    const client = clientTalking()

    client.sendRaw('not json at all')
    client.send(call(1, 'workspace_open', { workspace: '3d' }))

    expect(await client.answer()).toMatchObject({ id: 1, result: {} })
    expect(client.reported.join(' ')).toContain('was not JSON')
    client.close()
  })
})
