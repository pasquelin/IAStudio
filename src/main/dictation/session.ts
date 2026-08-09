import type {
  DownloadProgress,
  SttErrorCode,
  SttEvent,
  SttFailure,
  SttSnapshot,
  SttState,
} from '@shared/domain/dictation'
import { ChecksumMismatch } from './model-download'
import type { SttClient } from './stt-client'

/**
 * What a dictation session needs from the world. Every one of these is injected: the engine
 * needs a live application to fork, the download needs a network, and the microphone needs an
 * operating system — while what is decided below needs none of the three.
 */
export type SessionHost = {
  /** Where the model is read from, which the settings may point elsewhere. */
  modelFolder: () => string
  /** The detector shipped beside the application. */
  vadPath: () => string
  settings: () => {
    threads: number
    silenceMs: number
    previewMs: number
    idleUnloadMinutes: number
  }
  /** Whether the four files are on disk. Their digests were checked before they were renamed. */
  modelIsReady: () => Promise<boolean>
  /** Fetches the model, reporting bytes across the whole set. Rejects on refusal or cancel. */
  download: (onProgress: (progress: DownloadProgress) => void, signal: AbortSignal) => Promise<void>
  /** Asks the operating system, before the renderer ever opens a capture. */
  requestMicrophone: () => Promise<'granted' | 'denied' | 'unknown'>
  /** Forks the worker. The listeners are wired by the session, which is what reads them. */
  openEngine: (listeners: EngineListeners, onExit: () => void) => SttClient
  emit: (event: SttEvent) => void
  join: (folder: string, name: string) => string
  now: () => number
  /** Deferred so the idle timer can be driven by a test rather than waited on. */
  schedule: (run: () => void, delayMs: number) => () => void
}

export type EngineListeners = {
  onPartial: (text: string) => void
  onFinal: (text: string, latencyMs: number) => void
  onFailure: (error: Error) => void
}

export type DictationSession = {
  snapshot: () => SttSnapshot
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  push: (audio: Int16Array) => void
  downloadModel: () => Promise<void>
  cancelDownload: () => void
  /** Drops the engine and everything it holds. Called when the application is going away. */
  dispose: () => void
}

/**
 * How many times a crashed engine is restarted before the studio stops trying.
 *
 * Three, and then it stays in error: a process that dies on the first chunk of audio would
 * otherwise be forked again by the next chunk, for as long as someone keeps speaking.
 */
export const MAX_RESTARTS = 3

const failureOf = (code: SttErrorCode, error: unknown): SttFailure => ({
  code,
  message: error instanceof Error ? error.message : String(error),
})

export function createSession(host: SessionHost): DictationSession {
  let state: SttState = 'idle'
  let download: DownloadProgress | null = null
  let failure: SttFailure | null = null

  let engine: SttClient | null = null
  let restarts = 0
  let downloading: AbortController | null = null
  let cancelIdle: (() => void) | null = null

  const publish = (next: SttState): void => {
    if (state === next) return
    state = next
    host.emit({ type: 'state', state })
  }

  const refuse = (code: SttErrorCode, error: unknown): void => {
    failure = failureOf(code, error)
    host.emit({ type: 'error', failure })
    publish('error')
  }

  /**
   * Lets the engine go after a stretch of not dictating, returning around 700 MB. Rearmed on
   * every use, so the timer measures silence rather than uptime.
   */
  const armIdle = (): void => {
    cancelIdle?.()
    cancelIdle = null

    const minutes = host.settings().idleUnloadMinutes
    if (minutes <= 0) return

    cancelIdle = host.schedule(() => {
      // Never mid-sentence: the engine holds audio that has not been transcribed yet.
      if (state !== 'ready') return
      engine?.close()
      engine = null
      publish('idle')
    }, minutes * 60_000)
  }

  const listeners: EngineListeners = {
    onPartial: text => host.emit({ type: 'partial', text }),
    onFinal: (text, latencyMs) => host.emit({ type: 'final', text, latencyMs }),
    onFailure: error => {
      engine = null
      refuse('engineCrashed', error)
    },
  }

  const loadEngine = async (): Promise<boolean> => {
    if (engine) return true

    if (restarts >= MAX_RESTARTS) {
      refuse('engineCrashed', new Error(`the engine failed ${MAX_RESTARTS} times in a row`))
      return false
    }

    publish('loadingEngine')
    const folder = host.modelFolder()
    const settings = host.settings()
    const client = host.openEngine(listeners, () => {
      engine = null
    })

    try {
      await client.load({
        encoder: host.join(folder, 'encoder.int8.onnx'),
        decoder: host.join(folder, 'decoder.int8.onnx'),
        joiner: host.join(folder, 'joiner.int8.onnx'),
        tokens: host.join(folder, 'tokens.txt'),
        vad: host.vadPath(),
        threads: settings.threads,
        silenceMs: settings.silenceMs,
        previewMs: settings.previewMs,
      })
    } catch (error) {
      restarts += 1
      client.close()
      refuse('engineCrashed', error)
      return false
    }

    engine = client
    return true
  }

  const start = async (): Promise<void> => {
    if (state === 'listening') return

    const access = await host.requestMicrophone()
    if (access === 'denied') {
      failure = { code: 'permissionDenied', message: 'the operating system refused the microphone' }
      host.emit({ type: 'error', failure })
      publish('permissionRequired')
      return
    }

    if (!(await host.modelIsReady())) {
      publish('modelMissing')
      return
    }

    if (!(await loadEngine())) return

    // Cleared here rather than on every state change: what it says is why the engine is not
    // there, and it stops being true exactly when one starts.
    failure = null
    restarts = 0
    cancelIdle?.()
    cancelIdle = null
    publish('listening')
  }

  const settle = async (drop: boolean): Promise<void> => {
    if (state !== 'listening') return

    if (drop) engine?.cancel()
    else engine?.flush()

    publish('ready')
    armIdle()
  }

  return {
    snapshot: () => ({ state, download, failure }),

    start,
    stop: () => settle(false),
    cancel: () => settle(true),

    push: audio => {
      // Audio arriving after the session closed is not a failure: the capture takes a moment to
      // wind down, and its last chunk is already in flight when the key comes up.
      if (state === 'listening') engine?.push(audio)
    },

    downloadModel: async () => {
      if (downloading) return

      downloading = new AbortController()
      download = { received: 0, total: 0 }
      publish('downloadingModel')

      try {
        await host.download(progress => {
          download = progress
          host.emit({ type: 'download', progress })
        }, downloading.signal)

        download = null
        publish('idle')
      } catch (error) {
        download = null
        // A cancelled download is a decision, not a fault: it goes back to where it started.
        if (downloading.signal.aborted) publish('modelMissing')
        // Told apart because they lead somewhere different: a network that failed is worth
        // retrying, a file that failed its digest was deleted and says so.
        else if (error instanceof ChecksumMismatch) refuse('modelChecksumMismatch', error)
        else refuse('modelDownloadFailed', error)
      } finally {
        downloading = null
      }
    },

    cancelDownload: () => downloading?.abort(),

    dispose: () => {
      cancelIdle?.()
      downloading?.abort()
      engine?.close()
      engine = null
    },
  }
}
