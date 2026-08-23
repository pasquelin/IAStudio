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
})
