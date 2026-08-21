import { net } from 'electron'
import { chunksOf, decodedText } from '@main/netStream'
import type { OllamaPort, OllamaReply } from './ollamaRuntime'

/** Loopback and not `localhost`: the latter resolves to `::1` first, and Ollama binds `127.0.0.1`. */
const OLLAMA_ORIGIN = 'http://127.0.0.1:11434'

/** `net.fetch`, as the weights already use: one network door in the main process, proxy included. */
export function electronOllamaPort(origin = OLLAMA_ORIGIN): OllamaPort {
  return {
    send: async (method, path, body, signal): Promise<OllamaReply> => {
      const response = await net.fetch(`${origin}${path}`, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
      })

      return {
        ok: response.ok,
        status: response.status,
        chunks: decodedText(chunksOf(response.body)),
      }
    },
  }
}
