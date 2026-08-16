import type { Us } from '@/engines/timeline/timeline-state'
import { replayEdits, type AudioEdit, type TakeBounds, type TakeShape } from './edits'
import { encodeWav } from './wav'
import { silentBounds, type AudioData } from './audio-data'

/**
 * Replaying a five-step chain over a three-minute take costs 287 ms, and encoding the result
 * to WAV another 206 ms — half a second of frozen window for one click on "normalise", per
 * § 8.8. So it happens in a worker, and the samples move rather than being copied.
 */
export type AudioWorkerRequest =
  | { kind: 'load'; sampleRate: number; channels: Float32Array[] }
  | { kind: 'render'; id: number; edits: readonly AudioEdit[]; start: TakeBounds }

export type AudioWorkerResponse =
  | {
      kind: 'rendered'
      id: number
      sampleRate: number
      channels: Float32Array[]
      wav: Uint8Array<ArrayBuffer>
      shape: TakeShape
      silence: { head: Us; tail: Us }
    }
  | { kind: 'failed'; id: number; message: string }

/**
 * The take as the chain leaves it, with the bytes the editor plays and writes to disk — the shape
 * the montage clip under it takes, and where the silence at its two ends stops.
 *
 * All three ride along rather than being worked out on this side, because all three are measured
 * on the samples and the samples are over there. `silence` on EVERY render rather than on a
 * request of its own: `edgeSilences` walks in from each end until it hears something, so it reads
 * a handful of frames on anything but a wholly silent take — and on that one, a walk of eight
 * million frames is precisely what must not happen on the window's thread.
 */
export type RenderedAudio = {
  data: AudioData
  wav: Uint8Array<ArrayBuffer>
  shape: TakeShape
  silence: { head: Us; tail: Us }
}

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
  /**
   * The chain replayed over the slice of the take one block shows, and encoded. A call overtaken
   * by a newer one resolves to null.
   *
   * The slice comes as two NUMBERS rather than as an object, and that is not a style: React's
   * compiler cannot preserve a memo whose value is handed to a function it cannot see into, so
   * an object here forced the caller to depend on the clip by reference — and the write-back
   * mints a new clip, which bought a second render of half a second to answer the first one.
   */
  render: (edits: readonly AudioEdit[], inPoint: Us, duration: Us) => Promise<RenderedAudio | null>
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
        shape: message.shape,
        silence: message.silence,
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

    render: (edits, inPoint, duration) =>
      new Promise(resolve => {
        const id = nextId++
        latest = id

        // Sent before it is recorded, so a worker that will not take the take leaves no entry
        // behind — and the caller is answered rather than left on a promise nothing settles.
        // Safe in this order because a worker cannot answer during `postMessage`: its message
        // event is always a turn later.
        try {
          ensure().postMessage({ kind: 'render', id, edits, start: { inPoint, duration } }, [])
        } catch {
          // `null`, not a rejection: that is what `render` already answers when a worker dies
          // mid-take, and no caller of it catches. The port goes with it, so the next take
          // builds a fresh one.
          port = null
          resolve(null)
          return
        }

        waiting.set(id, resolve)
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

  const { data, shape } = replayEdits(source, request.edits, request.start)
  // A chain that changed nothing hands its input straight back, and transferring that would
  // take the source away from every render after this one.
  const channels = data.channels.map(channel =>
    source.channels.includes(channel) ? channel.slice() : channel,
  )
  const wav = encodeWav({ sampleRate: data.sampleRate, channels })

  return {
    response: {
      kind: 'rendered',
      silence: silentBounds(data),
      id: request.id,
      sampleRate: data.sampleRate,
      channels,
      wav,
      shape,
    },
    transfer: [...channels.map(channel => channel.buffer), wav.buffer],
  }
}
