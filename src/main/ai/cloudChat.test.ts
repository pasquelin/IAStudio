import { describe, expect, it, vi } from 'vitest'
import type { HttpChat } from '@shared/domain/aiCloud'
import { askCloudChat } from './cloudChat'

const answerFor = (kind: HttpChat['kind']): Response =>
  new Response(
    JSON.stringify(
      kind === 'anthropic'
        ? { content: [{ text: 'ok' }] }
        : kind === 'gemini'
          ? { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }
          : { choices: [{ message: { content: 'ok' } }] },
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )

const chats: readonly HttpChat[] = [
  { kind: 'openai', baseUrl: 'https://example.test/v1', model: 'vision' },
  { kind: 'anthropic', model: 'vision' },
  { kind: 'gemini', model: 'vision' },
]

function expectedImageBody(kind: HttpChat['kind']): Record<string, unknown> {
  const image = { mimeType: 'image/png', data: 'AQID' }
  if (kind === 'openai') {
    return {
      messages: [
        { role: 'system', content: 'system' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'inspect' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } },
          ],
        },
      ],
    }
  }
  if (kind === 'anthropic') {
    return {
      system: 'system',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'inspect' },
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mimeType, data: image.data },
            },
          ],
        },
      ],
    }
  }
  return {
    systemInstruction: { parts: [{ text: 'system' }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: 'inspect' }, { inlineData: image }],
      },
    ],
  }
}

describe('askCloudChat visual context', () => {
  it.each(chats)('encodes an in-memory image for $kind', async chat => {
    const post = vi.fn(async (_url: string, _init?: RequestInit) => answerFor(chat.kind))

    await askCloudChat(
      {
        chat,
        key: 'key',
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'inspect' },
        ],
        images: [{ mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }],
        json: false,
        maxTokens: 20,
      },
      post,
    )

    const body: unknown = JSON.parse(String(post.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject(expectedImageBody(chat.kind))
  })

  it('keeps the established text-only payload free of image blocks', async () => {
    const chat: HttpChat = {
      kind: 'openai',
      baseUrl: 'https://example.test/v1',
      model: 'text',
    }
    const post = vi.fn(async (_url: string, _init?: RequestInit) => answerFor(chat.kind))

    await askCloudChat(
      {
        chat,
        key: 'key',
        messages: [{ role: 'user', content: 'hello' }],
        json: false,
        maxTokens: 20,
      },
      post,
    )

    expect(JSON.parse(String(post.mock.calls[0]?.[1]?.body))).toMatchObject({
      messages: [{ role: 'user', content: 'hello' }],
    })
  })
})
