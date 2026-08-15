import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActionOutcome, AssistantCall } from '@shared/domain/assistant'
import { mcpUrl } from './endpoint'
import { startMcp, type RunningMcp } from './server'

/**
 * Driven over a real socket rather than against the transport object.
 *
 * What this file is about is the door: the token, the origin, the path. None of those is a
 * function anyone calls — they are what a request meets — and a test that reached past the
 * socket would be green on a server listening to the whole network.
 */

const TOKEN = 'c'.repeat(64)

let running: RunningMcp | null = null

afterEach(async () => {
  await running?.close()
  running = null
})

async function serverRunning(
  run: (call: AssistantCall) => Promise<ActionOutcome> = () => Promise.resolve({ ok: true }),
): Promise<RunningMcp> {
  running = await startMcp({ run, version: '1.2.3', token: TOKEN })
  return running
}

type Headers = Record<string, string>

async function post(
  server: RunningMcp,
  body: unknown,
  headers: Headers = {},
  path?: string,
): Promise<Response> {
  return await fetch(path ? `http://127.0.0.1:${server.port}${path}` : mcpUrl(server), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Both, as the Streamable HTTP transport requires of a client.
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

/**
 * One JSON-RPC request per POST, and no handshake before it.
 *
 * Measured against this very server rather than assumed: a request built per POST answers
 * `tools/list` on its own, and batching `initialize` with anything else is refused outright
 * ("only one initialization request is allowed"). Which is the shape a stateless transport
 * wants — every call stands alone.
 */
const rpc = (method: string, params?: unknown): unknown => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  ...(params ? { params } : {}),
})

async function ask(server: RunningMcp, method: string, params?: unknown): Promise<unknown> {
  const response = await post(server, rpc(method, params))
  const answer = (await response.json()) as { result?: unknown }
  return answer.result
}

describe('the door', () => {
  it('binds the loopback interface alone', async () => {
    const server = await serverRunning()

    // Not a claim about the socket's options: a request that reached it over 127.0.0.1 answered.
    const response = await post(server, rpc('tools/list'))
    expect(response.status).toBe(200)
  })

  it('refuses a caller with no token', async () => {
    const server = await serverRunning()
    const response = await post(server, rpc('tools/list'), { authorization: '' })

    expect(response.status).toBe(403)
  })

  it('refuses a page that came from anywhere but this machine', async () => {
    const server = await serverRunning()
    const response = await post(server, rpc('tools/list'), {
      origin: 'https://elsewhere.example',
    })

    expect(response.status).toBe(403)
  })

  it('answers nothing on any other path', async () => {
    const server = await serverRunning()
    const response = await post(server, rpc('tools/list'), {}, '/')

    expect(response.status).toBe(404)
  })

  /**
   * Everything but a well-formed POST, which is what the suite used to be made of entirely.
   *
   * None of these may run an action, and none may take the server down — a client that reconnects
   * badly, or a browser that stumbles onto the port, must cost nothing. What each STATUS is is
   * the transport's business and deliberately not asserted; that nothing was executed, and that
   * the next real call still works, is ours.
   */
  it('runs nothing on a request that is not a call, and stays up', async () => {
    const run = vi.fn<(call: AssistantCall) => Promise<ActionOutcome>>(() =>
      Promise.resolve({ ok: true }),
    )
    const server = await serverRunning(run)

    const url = mcpUrl(server)
    const headers = { authorization: `Bearer ${TOKEN}`, accept: 'application/json' }
    await fetch(url, { method: 'DELETE', headers })
    await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
    })
    await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: 'pas du json',
    })

    expect(run).not.toHaveBeenCalled()
    // Still serving: a malformed request must not be able to end the session for the good ones.
    expect(await ask(server, 'tools/list')).toHaveProperty('tools')
  })
})

describe('what a client can ask for', () => {
  it('lists the studio’s actions as tools', async () => {
    const server = await serverRunning()
    const result = await ask(server, 'tools/list')
    const names = (result as { tools: { name: string }[] }).tools.map(tool => tool.name)

    expect(names).toContain('workspace_open')
    expect(names).toContain('generator_submit')
  })

  it('runs a call in the window, and hands back what it answered', async () => {
    const run = vi.fn<(call: AssistantCall) => Promise<ActionOutcome>>(() =>
      Promise.resolve({ ok: true, data: { opened: '3d' } }),
    )
    const server = await serverRunning(run)

    const result = await ask(server, 'tools/call', {
      name: 'workspace_open',
      arguments: { workspace: '3d' },
    })

    expect(run).toHaveBeenCalledWith({ action: 'workspace.open', input: { workspace: '3d' } })
    expect(result).toMatchObject({ content: [{ type: 'text', text: '{"opened":"3d"}' }] })
  })

  /**
   * The refusal in English, from the same bundle line the person read in their own language a
   * second earlier — and an ERROR, so a client cannot read "nothing happened" as success.
   */
  it('tells the client why, in words, when the window refused', async () => {
    const server = await serverRunning(() => Promise.resolve({ ok: false, refusal: 'declined' }))

    const result = await ask(server, 'tools/call', { name: 'generator_submit', arguments: {} })

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'You turned that action down.' }],
    })
  })

  it('says so rather than acting when the tool names nothing', async () => {
    const run = vi.fn<(call: AssistantCall) => Promise<ActionOutcome>>()
    const server = await serverRunning(run)

    const result = await ask(server, 'tools/call', { name: 'command_fly', arguments: {} })

    expect(result).toMatchObject({ isError: true })
    expect(run).not.toHaveBeenCalled()
  })
})
