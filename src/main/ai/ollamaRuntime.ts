import type { DownloadProgress } from '@shared/domain/localModel'
import { ollamaModel, type OllamaTag } from '@shared/domain/ollamaModel'
import type { ChatRequest, LocalRuntime } from './localRuntimes'

export type OllamaPort = {
  tags: () => Promise<readonly OllamaTag[]>
  pull: (
    name: string,
    onProgress: (progress: DownloadProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>
  remove: (name: string) => Promise<void>
  chat: (request: ChatRequest) => Promise<string>
}

const ORIGIN = 'http://127.0.0.1:11434'
const TAGS_MS = 2000

export function ollamaHttpPort(origin = ORIGIN, send: typeof fetch = fetch): OllamaPort {
  const url = (path: string) => `${origin}${path}`

  return {
    tags: async () => {
      const response = await send(url('/api/tags'), { signal: AbortSignal.timeout(TAGS_MS) })
      if (!response.ok) throw new Error(`ollama /api/tags ${response.status}`)

      const body: unknown = await response.json()
      const models =
        body && typeof body === 'object' && 'models' in body && Array.isArray(body.models)
          ? body.models
          : []

      return models.flatMap((entry: unknown): OllamaTag[] => {
        if (!entry || typeof entry !== 'object') return []
        const name = 'name' in entry ? entry.name : undefined
        const size = 'size' in entry ? entry.size : undefined
        if (typeof name !== 'string' || name === '' || typeof size !== 'number') return []
        return [{ name, size }]
      })
    },

    pull: async (name, onProgress, signal) => {
      const response = await send(url('/api/pull'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: name, stream: true }),
        signal,
      })
      if (!response.ok) throw new Error(`ollama /api/pull ${response.status}`)
      if (!response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let rest = ''
      for (;;) {
        const { done, value } = await reader.read()
        rest += decoder.decode(value ?? new Uint8Array(), { stream: !done })
        const lines = rest.split('\n')
        rest = done ? '' : (lines.pop() ?? '')
        for (const line of lines) {
          if (line.trim() === '') continue
          try {
            const event: unknown = JSON.parse(line)
            if (!event || typeof event !== 'object') continue
            const total = 'total' in event && typeof event.total === 'number' ? event.total : null
            const completed =
              'completed' in event && typeof event.completed === 'number' ? event.completed : 0
            if (total !== null) onProgress({ received: completed, total })
          } catch {
            // A truncated frame is ordinary on a cancelled pull.
          }
        }
        if (done) break
      }
    },

    remove: async name => {
      const response = await send(url('/api/delete'), {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: name }),
      })
      if (!response.ok) throw new Error(`ollama /api/delete ${response.status}`)
    },

    chat: async request => {
      const response = await send(url('/api/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
          keep_alive: '5m',
          options: { num_ctx: request.contextTokens },
          ...(request.json ? { format: 'json' } : {}),
        }),
        signal: request.signal,
      })
      if (!response.ok) throw new Error(`ollama /api/chat ${response.status}`)

      const body: unknown = await response.json()
      const message =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        body.message &&
        typeof body.message === 'object'
          ? body.message
          : null
      const content =
        message && 'content' in message && typeof message.content === 'string'
          ? message.content
          : ''
      return content
    },
  }
}

/**
 * Ollama as a runtime. The studio does not start it: `ready: false` is ordinary when nothing
 * answers on :11434.
 */
export function ollamaLocalRuntime(port: OllamaPort): LocalRuntime {
  let inflight: Promise<readonly OllamaTag[]> | null = null
  let lastOk: { at: number; tags: readonly OllamaTag[] } | null = null
  let downAt: number | null = null

  const listed = (): Promise<readonly OllamaTag[]> => {
    const now = Date.now()
    if (downAt !== null && now - downAt < 10_000) return Promise.reject(new Error('ollama down'))
    if (lastOk !== null && now - lastOk.at < 3000) return Promise.resolve(lastOk.tags)
    if (inflight) return inflight

    inflight = port
      .tags()
      .then(tags => {
        lastOk = { at: Date.now(), tags }
        downAt = null
        return tags
      })
      .catch((error: unknown) => {
        downAt = Date.now()
        lastOk = null
        throw error
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  const forgetTags = (): void => {
    lastOk = null
    downAt = null
    inflight = null
  }

  return {
    discover: async () => {
      try {
        return (await listed()).flatMap(tag => {
          const model = ollamaModel(tag)
          return model ? [model] : []
        })
      } catch {
        return []
      }
    },

    read: async models => {
      try {
        const names = new Set((await listed()).map(tag => tag.name))
        return {
          ready: true,
          installed: new Set(models.filter(model => names.has(model.id)).map(model => model.id)),
          loaded: new Set(),
        }
      } catch {
        return { ready: false, installed: new Set(), loaded: new Set() }
      }
    },

    install: async (model, onProgress, signal) => {
      forgetTags()
      await port.pull(model.id, onProgress, signal)
      forgetTags()
    },
    remove: async model => {
      forgetTags()
      await port.remove(model.id)
      forgetTags()
    },
    chat: request => port.chat(request),
  }
}
