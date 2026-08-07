import { renderEdits, type AudioEdit } from './edits'
import { encodeWav } from './wav'
import type { AudioData } from './audio-data'

/**
 * Replaying a five-step chain over a three-minute take costs 287 ms, and encoding the result
 * to WAV another 206 ms — half a second of frozen window for one click on "normalise", per
 * § 8.8. So it happens in a worker, and the samples move rather than being copied.
 */
export type AudioWorkerRequest =
  | { kind: 'load'; sampleRate: number; channels: Float32Array[] }
  | { kind: 'render'; id: number; edits: readonly AudioEdit[] }

export type AudioWorkerResponse =
  | {
      kind: 'rendered'
      id: number
      sampleRate: number
      channels: Float32Array[]
      wav: Uint8Array<ArrayBuffer>
    }
  | { kind: 'failed'; id: number; message: string }

/** The take as the chain leaves it, with the bytes the editor plays and writes to disk. */
export type RenderedAudio = { data: AudioData; wav: Uint8Array<ArrayBuffer> }

/**
 * What the renderer needs of a worker. Narrowed to three members so a test can stand in for
 * one: jsdom ships no `Worker`, and the arithmetic worth testing is on the other side anyway.
 */
export type WorkerPort = {
  postMessage: (message: AudioWorkerRequest, transfer: Transferable[]) => void
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<AudioWorkerResponse>) => void,
  ) => void
  /** Assigned rather than added to: one renderer owns one worker, and reads its failures alone. */
  onerror: ((event: ErrorEvent) => void) | null
  terminate: () => void
}

export type AudioRenderer = {
  /** Hands the take over. Its buffers move: the caller must not read them afterwards. */
  load: (source: AudioData) => void
  /** The chain replayed and encoded. A call overtaken by a newer one resolves to null. */
  render: (edits: readonly AudioEdit[]) => Promise<RenderedAudio | null>
  dispose: () => void
}

/**
 * `open` is called on the first take rather than here, so building the renderer is pure: React
 * may run a state initialiser twice and throw one result away, and a worker spawned there
 * would be the one nothing ever terminates.
 */
export function createAudioRenderer(open: () => WorkerPort): AudioRenderer {
  let nextId = 0
  let latest = -1
  let port: WorkerPort | null = null
  const waiting = new Map<number, (result: RenderedAudio | null) => void>()

  const settle = (id: number, result: RenderedAudio | null): void => {
    // Everything older than the answer that just arrived is never coming: the worker replies
    // in order, so an earlier id still waiting has been overtaken.
    for (const [pending, resolve] of waiting) {
      if (pending > id) continue
      waiting.delete(pending)
      resolve(pending === id ? result : null)
    }
  }

  const ensure = (): WorkerPort => {
    if (port) return port

    const opened = open()
    opened.addEventListener('message', event => {
      const message = event.data
      if (message.kind === 'failed') {
        settle(message.id, null)
        return
      }
      settle(message.id, {
        data: { sampleRate: message.sampleRate, channels: message.channels },
        wav: message.wav,
      })
    })

    // A worker that dies — a take too long to allocate is the way it happens — answers nothing
    // ever again. Without this the editor waits on that answer for as long as it is open.
    opened.onerror = () => {
      settle(latest, null)
      port = null
      opened.terminate()
    }

    port = opened
    return opened
  }

  return {
    load: source =>
      ensure().postMessage(
        { kind: 'load', sampleRate: source.sampleRate, channels: source.channels },
        source.channels.map(channel => channel.buffer),
      ),

    render: edits =>
      new Promise(resolve => {
        const id = nextId++
        latest = id
        waiting.set(id, resolve)
        ensure().postMessage({ kind: 'render', id, edits }, [])
      }),

    dispose: () => {
      settle(latest, null)
      port?.terminate()
      port = null
    },
  }
}

/** The worker's own state: the take it was handed, kept so a render costs no second copy. */
export type AudioWorkerState = { source: AudioData | null }

/**
 * One request, answered. Pure and worker-free so it can be tested directly: `audio.worker.ts`
 * is only the wiring that carries this between the two threads.
 */
export function handleRequest(
  state: AudioWorkerState,
  request: AudioWorkerRequest,
): { response: AudioWorkerResponse; transfer: Transferable[] } | null {
  if (request.kind === 'load') {
    state.source = { sampleRate: request.sampleRate, channels: request.channels }
    return null
  }

  const source = state.source
  if (!source) {
    return { response: { kind: 'failed', id: request.id, message: 'no take loaded' }, transfer: [] }
  }

  const data = renderEdits(source, request.edits)
  // A chain that changed nothing hands its input straight back, and transferring that would
  // take the source away from every render after this one.
  const channels = data.channels.map(channel =>
    source.channels.includes(channel) ? channel.slice() : channel,
  )
  const wav = encodeWav({ sampleRate: data.sampleRate, channels })

  return {
    response: { kind: 'rendered', id: request.id, sampleRate: data.sampleRate, channels, wav },
    transfer: [...channels.map(channel => channel.buffer), wav.buffer],
  }
}
