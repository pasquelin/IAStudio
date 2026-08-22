import type { DownloadProgress } from '@shared/domain/localModel'
import { ollamaModel, type OllamaTag } from '@shared/domain/ollamaModel'
import { isRecord } from '@shared/guards'
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
const TAGS_MS = 2_000
const DOWN_MS = 10_000
const FRESH_MS = 3_000

export function ollamaHttpPort(origin = ORIGIN, send: typeof fetch = fetch): OllamaPort {
  const url = (path: string) => `${origin}${path}`

  return {
    tags: async () => {
      const response = await send(url('/api/tags'), { signal: AbortSignal.timeout(TAGS_MS) })
      if (!response.ok) throw new Error(`ollama /api/tags ${response.status}`)

      const body: unknown = await response.json()
      const models = isRecord(body) && Array.isArray(body.models) ? body.models : []

      return models.flatMap((entry: unknown): OllamaTag[] => {
        if (!isRecord(entry)) return []
        const { name, size } = entry
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
            if (!isRecord(event) || typeof event.total !== 'number') continue
            onProgress({
              received: typeof event.completed === 'number' ? event.completed : 0,
              total: event.total,
            })
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
      if (!isRecord(body) || !isRecord(body.message)) return ''
      return typeof body.message.content === 'string' ? body.message.content : ''
    },
  }
}

export type OllamaRuntimeHooks = {
  /** Starts the service if it is already on this machine. Absent: the studio does not start it. */
  ensure?: () => Promise<boolean>
  /** A listing just went stale — a tag deleted outside, a chat that found nothing. Never a delete. */
  onStale?: () => void
}

/**
 * Ollama as a runtime. Starting is `ensure`'s job; this runtime never stops or uninstalls it.
 */
export function ollamaLocalRuntime(port: OllamaPort, hooks: OllamaRuntimeHooks = {}): LocalRuntime {
  let inflight: Promise<readonly OllamaTag[]> | null = null
  let lastOk: { at: number; tags: readonly OllamaTag[] } | null = null
  let downAt: number | null = null

  function remember(tags: readonly OllamaTag[]): readonly OllamaTag[] {
    lastOk = { at: Date.now(), tags }
    downAt = null
    return tags
  }

  async function fetchTags(): Promise<readonly OllamaTag[]> {
    try {
      return remember(await port.tags())
    } catch (error: unknown) {
      if (hooks.ensure && (await hooks.ensure())) {
        try {
          return remember(await port.tags())
        } catch {
          // Still down after a start: mark it, same as the first refusal.
        }
      }
      downAt = Date.now()
      lastOk = null
      throw error
    }
  }

  function listed(): Promise<readonly OllamaTag[]> {
    const now = Date.now()
    if (downAt !== null && now - downAt < DOWN_MS) return Promise.reject(new Error('ollama down'))
    if (lastOk !== null && now - lastOk.at < FRESH_MS) return Promise.resolve(lastOk.tags)
    if (inflight) return inflight

    inflight = fetchTags().finally(() => {
      inflight = null
    })
    return inflight
  }

  function forgetTags(): void {
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
    chat: async request => {
      try {
        return await port.chat(request)
      } catch (error: unknown) {
        forgetTags()
        hooks.onStale?.()
        throw error
      }
    },
  }
}
