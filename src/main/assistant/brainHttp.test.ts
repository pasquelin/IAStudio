import { describe, expect, it, vi } from 'vitest'
import type { AssistantThought } from '@shared/domain/assistant'
import { createHttpChatBrain } from './brainHttp'

const thought: AssistantThought = { utterance: 'hello', history: [] }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('createHttpChatBrain', () => {
  it('refuses to think when no key is held', async () => {
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      model: () => 'gpt-4o-mini',
      credentials: () => null,
      fetch: vi.fn(),
    })

    await expect(brain.think(thought)).rejects.toThrow(/no key/)
  })

  it('reads the assistant text out of an OpenAI-shaped answer', async () => {
    const post = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: '{"say":"hi","calls":[]}' } }],
      }),
    )
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      model: () => 'gpt-4o-mini',
      credentials: () => ({ key: 'sk-test', secret: '' }),
      fetch: post,
    })

    const answer = await brain.think(thought)

    expect(answer.say).toBe('hi')
    expect(answer.cost).toBe(0)
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer sk-test' }),
      }),
    )
  })

  /**
   * Defect 1 and defect 3 in one turn, and the reason they were one fix: this door was held to
   * Scenario's ten thousand characters, so a nine-thousand-character paste came out cut to four
   * and the catalogue could never grow past eleven actions.
   */
  it('shows a chat cloud the whole registry, and sends the sentence uncut', async () => {
    let sent = ''
    const post = vi.fn(async (_url: string, init?: RequestInit) => {
      sent = String(init?.body)
      return jsonResponse({ choices: [{ message: { content: '{"say":"ok","calls":[]}' } }] })
    })
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      model: () => 'deepseek-chat',
      credentials: () => ({ key: 'sk-test', secret: '' }),
      fetch: post,
    })

    await brain.think({ utterance: 'x'.repeat(9_000), history: [] })

    const body: unknown = JSON.parse(sent)
    const messages = (body as { messages: { content: string }[] }).messages
    expect(messages[0]?.content).toContain('  git.checkout —')
    expect(messages[1]?.content).toContain('x'.repeat(9_000))
  })

  /**
   * The room a cloud holds is an ASSUMPTION — the model is typed by hand, and a small one named
   * there refuses 70 000 characters of catalogue. What degrades is one round trip, not the turn.
   */
  it('asks again with the short list when the cloud refused the whole catalogue', async () => {
    const sent: string[] = []
    let first = true
    const post = vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body))
      if (first) {
        first = false
        return jsonResponse({ error: { message: 'context length exceeded' } }, 400)
      }
      return jsonResponse({ choices: [{ message: { content: '{"say":"ok","calls":[]}' } }] })
    })
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'tiny' },
      model: () => 'tiny',
      credentials: () => ({ key: 'sk-test', secret: '' }),
      fetch: post,
    })

    await expect(brain.think(thought)).resolves.toMatchObject({ say: 'ok' })
    expect(sent[0]).toContain('git.checkout')
    expect(sent[1]).not.toContain('git.checkout')
  })

  /**
   * 🛑 A quota is not a size. Narrowing on any error at all fired a SECOND request straight into
   * a rate limit, and answered from the eleven-action short list on a transient 500 — with
   * nothing on screen to say the assistant's vocabulary had shrunk for that turn.
   */
  it('does not narrow on a refusal that says nothing about the size', async () => {
    const post = vi.fn(async () => jsonResponse({ error: { message: 'rate limited' } }, 429))
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      model: () => 'deepseek-chat',
      credentials: () => ({ key: 'sk-test', secret: '' }),
      fetch: post,
    })

    await expect(brain.think(thought)).rejects.toThrow(/rate limited/)
    expect(post).toHaveBeenCalledOnce()
  })

  it('folds prior turns into one user message, which Anthropic requires', async () => {
    let sent = ''
    const post = vi.fn(async (_url: string, init?: RequestInit) => {
      sent = String(init?.body)
      return jsonResponse({
        choices: [{ message: { content: '{"say":"ok","calls":[]}' } }],
      })
    })
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      model: () => 'gpt-4o-mini',
      credentials: () => ({ key: 'sk-test', secret: '' }),
      fetch: post,
    })

    await brain.think({ utterance: 'now', history: ['yesterday'] })

    expect(sent).toContain('yesterday')
    expect(sent).toContain('now')
    expect(sent.split('"role":"user"').length - 1).toBe(1)
  })

  it('reads Anthropic content blocks', async () => {
    const post = vi.fn(async () =>
      jsonResponse({ content: [{ type: 'text', text: '{"say":"ok","calls":[]}' }] }),
    )
    const brain = createHttpChatBrain({
      chat: { kind: 'anthropic', model: 'claude-sonnet-4-5' },
      model: () => 'claude-sonnet-4-5',
      credentials: () => ({ key: 'ant-key', secret: '' }),
      fetch: post,
    })

    expect((await brain.think(thought)).say).toBe('ok')
    expect(post).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'ant-key' }),
      }),
    )
  })

  it('reads Gemini candidates', async () => {
    const post = vi.fn(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"say":"yo","calls":[]}' }] } }],
      }),
    )
    const brain = createHttpChatBrain({
      chat: { kind: 'gemini', model: 'gemini-2.0-flash' },
      model: () => 'gemini-2.0-flash',
      credentials: () => ({ key: 'gem-key', secret: '' }),
      fetch: post,
    })

    expect((await brain.think(thought)).say).toBe('yo')
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.0-flash'),
      expect.anything(),
    )
    expect(post).toHaveBeenCalledWith(expect.stringContaining('key=gem-key'), expect.anything())
  })
  it('asks the model the settings name, read again on each turn', async () => {
    const sent: string[] = []
    const post = vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body))
      return jsonResponse({ choices: [{ message: { content: '{"say":"ok","calls":[]}' } }] })
    })
    let chosen = 'deepseek-chat'
    const brain = createHttpChatBrain({
      chat: { kind: 'openai', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      model: () => chosen,
      credentials: () => ({ key: 'ds-key', secret: '' }),
      fetch: post,
    })

    await brain.think(thought)
    chosen = 'deepseek-reasoner'
    await brain.think(thought)

    expect(sent[0]).toContain('"model":"deepseek-chat"')
    expect(sent[1]).toContain('"model":"deepseek-reasoner"')
  })
  /** The model is typed by hand now: a `#` in it truncated the URL and took `?key=` with it. */
  it('encodes the model name it puts in the Gemini path', async () => {
    const post = vi.fn(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"say":"ok","calls":[]}' }] } }] }),
    )
    const brain = createHttpChatBrain({
      chat: { kind: 'gemini', model: 'gemini-2.0-flash' },
      model: () => 'models/one#two',
      credentials: () => ({ key: 'gem-key', secret: '' }),
      fetch: post,
    })

    await brain.think(thought)

    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('models%2Fone%23two:generateContent'),
      expect.anything(),
    )
    expect(post).toHaveBeenCalledWith(expect.stringContaining('key=gem-key'), expect.anything())
  })
})
