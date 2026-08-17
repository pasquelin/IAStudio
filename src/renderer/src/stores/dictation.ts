import { create } from 'zustand'
import type { DownloadProgress, InputDevice, SttFailure, SttState } from '@shared/domain/dictation'
import { getBridge } from '@/services/bridge'
import {
  listInputDevices,
  MicrophoneRefused,
  NoInputDevice,
  startCapture,
  type Capture,
} from '@/dictation/capture'
import { mountedDictationTarget } from '@/dictation/destination'
import { insertAtCaret } from '@/dictation/insertAtCaret'
import { useSettings } from './settings'

type DictationState = {
  state: SttState
  /** The running hypothesis. Replaced by the next one, cleared when a sentence settles. */
  partial: string
  /** Input level, 0 to 1. Measured in this window and never sent anywhere. */
  level: number
  download: DownloadProgress | null
  failure: SttFailure | null
  devices: InputDevice[]

  /** Follows the session and reads its state. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  /** Opens the microphone and the engine. Does nothing if a session is already running. */
  start: () => Promise<void>
  /** Settles the sentence in flight and closes the microphone. */
  stop: () => Promise<void>
  /** Drops the sentence in flight. Nothing is inserted. */
  cancel: () => Promise<void>
  /**
   * The shortcut, pressed or released. What that means is the mode's business, and the mode
   * needs the state of the session — so it is decided here rather than in a component.
   */
  setHeld: (held: boolean) => Promise<void>
  downloadModel: () => Promise<void>
  cancelDownload: () => Promise<void>
  openPrivacySettings: () => Promise<void>
  refreshDevices: () => Promise<void>
}

/**
 * The capture, which is not state: it holds a `MediaStream` and an `AudioContext`, neither of
 * which any render reads. Kept beside the store rather than in it, the way `stores/peaks.ts`
 * keeps its pending set outside — a re-render per audio chunk would be ten a second.
 */
let capture: Capture | null = null

/**
 * Which session a capture belongs to.
 *
 * `capture` is only assigned once `startCapture` resolves, and two awaits stand before that —
 * the round trip that may load 700 MB, then `getUserMedia`. A stop landing in that window found
 * nothing to close, and the stream opened behind it stayed live with the microphone light on,
 * blocking every later start. Bumped synchronously by whoever ends a session, so the start that
 * is still running knows its stream is no longer wanted.
 */
let session = 0

/**
 * Which announced states end the session, as opposed to being crossed on the way into one.
 *
 * Exhaustive rather than a comparison: a ninth state added to `SttState` stops compiling here,
 * and a transitional one would otherwise fall in as an ending and void the start still in flight.
 */
const ENDS_SESSION: Record<SttState, boolean> = {
  idle: true,
  permissionRequired: true,
  modelMissing: true,
  downloadingModel: true,
  loadingEngine: false,
  ready: true,
  listening: false,
  error: true,
}

const failureOf = (error: unknown): SttFailure => {
  if (error instanceof MicrophoneRefused) {
    return { code: 'permissionDenied', message: error.message }
  }
  if (error instanceof NoInputDevice) return { code: 'noInputDevice', message: error.message }

  return {
    code: 'engineCrashed',
    message: error instanceof Error ? error.message : String(error),
  }
}

/**
 * A dictation session, as this window sees it.
 *
 * The engine and the model live in the main process; what is here is the microphone, the level,
 * and the text on its way to a field.
 */
export const useDictation = create<DictationState>()((set, get) => ({
  state: 'idle',
  partial: '',
  level: 0,
  download: null,
  failure: null,
  devices: [],

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    let pushed = false
    const stop = bridge.dictation.onEvent(event => {
      pushed = true

      if (event.type === 'state') {
        // Any state but `listening` stops the microphone, even when it came from the main
        // process — an engine that crashed leaves a capture nobody is reading. Only an ending
        // also voids the start in flight: `loadingEngine` is published while that start is
        // still awaiting the main process, and voiding it there left the first dictation of a
        // run with a shut microphone under a button that already said it was listening.
        if (event.state !== 'listening') {
          void (ENDS_SESSION[event.state] ? closeCapture() : stopCapture())
        }
        set({ state: event.state, ...(event.state === 'listening' ? { partial: '' } : {}) })
        return
      }

      if (event.type === 'partial') set({ partial: event.text })
      else if (event.type === 'final') {
        set({ partial: '' })
        settle(event.text)
      } else if (event.type === 'download') set({ download: event.progress })
      else set({ failure: event.failure })
    })

    try {
      const snapshot = await bridge.dictation.state()
      // A snapshot in flight must not overwrite an event that arrived after it was asked for.
      if (!pushed) set(snapshot)
    } catch {
      // The subscription holds; the state simply stays where it started.
    }

    return () => {
      stop()
      void closeCapture()
    }
  },

  start: async () => {
    const bridge = getBridge()
    if (!bridge || capture) return

    const mine = (session += 1)
    set({ failure: null })
    await bridge.dictation.start()

    /**
     * Only once the main process says it is listening: the model may be missing, or the
     * microphone refused, and opening a stream then would ask for a device for nothing.
     *
     * ASKED rather than read off the store, and that is the whole fix. The main process publishes
     * `listening` on the event channel while `start()` answers on the invoke channel, and nothing
     * orders the two: read here, the cached state was still the previous one often enough that
     * this returned without ever opening a stream — and the event landed a moment later, so the
     * status line said "the assistant is listening" over a microphone that was never on. macOS
     * showed no recording indicator, which is how it was caught.
     */
    const live = await bridge.dictation.state().catch(() => null)
    if (mine !== session || live?.state !== 'listening') return

    const chosen = useSettings.getState().settings.dictation.inputDeviceId

    try {
      const opened = await startCapture({
        ...(chosen ? { deviceId: chosen } : {}),
        onChunk: chunk => {
          // `Int16Array` over a plain `ArrayBuffer`, so its buffer is one: only a shared buffer
          // would not be, and nothing here makes one.
          void bridge.dictation.push(chunk.buffer as ArrayBuffer)
        },
        onLevel: level => set({ level }),
      })

      // Let go of the key while the device was opening, and this stream is already stale: it is
      // closed here rather than kept, because nothing else holds a reference to it.
      if (mine !== session) await opened.stop()
      else capture = opened
    } catch (error) {
      set({ failure: failureOf(error) })
      await bridge.dictation.cancel()
    }
  },

  stop: async () => {
    await closeCapture()
    await getBridge()?.dictation.stop()
  },

  cancel: async () => {
    await closeCapture()
    set({ partial: '' })
    await getBridge()?.dictation.cancel()
  },

  setHeld: async held => {
    const { mode } = useSettings.getState().settings.dictation

    if (mode === 'pushToTalk') await (held ? get().start() : get().stop())
    // Toggling acts on the press alone: acting on the release too would start and stop it in
    // the time it takes to tap a key.
    else if (held) await (get().state === 'listening' ? get().stop() : get().start())
  },

  downloadModel: async () => {
    await getBridge()?.dictation.downloadModel()
  },

  cancelDownload: async () => {
    await getBridge()?.dictation.cancelDownload()
  },

  openPrivacySettings: async () => {
    await getBridge()?.dictation.openPrivacySettings()
  },

  refreshDevices: async () => {
    // Labels stay empty until access has been granted once, so this is worth asking again
    // after a session rather than only at startup.
    set({ devices: await listInputDevices() })
  },
}))

/**
 * Where a settled sentence goes.
 *
 * Whoever claimed it, and the caret otherwise — which is what makes dictation work in every
 * input of the studio without any of them being rewritten. This session knows nothing about who
 * claims it or why; the assistant's modal does the claiming while it is up.
 */
function settle(text: string): void {
  const target = mountedDictationTarget()
  if (target) target(text)
  else insertAtCaret(text)
}

async function closeCapture(): Promise<void> {
  // Bumped before the first await, so a start still opening a device sees it and closes what it
  // was about to keep. Every path that ends a session comes through here, the engine crashing
  // included.
  session += 1
  await stopCapture()
}

/** The microphone alone. A start still opening one keeps its claim on the session. */
async function stopCapture(): Promise<void> {
  const running = capture
  capture = null
  useDictation.setState({ level: 0 })
  await running?.stop()
}
