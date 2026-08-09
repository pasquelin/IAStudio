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
import { insertAtCaret } from '@/dictation/insert-at-caret'
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
  downloadModel: () => Promise<void>
  cancelDownload: () => Promise<void>
  openPrivacySettings: () => Promise<void>
  refreshDevices: () => Promise<void>
  /**
   * Where a settled sentence goes. Claimed by `useDictation` for as long as a component asks
   * for it; absent — the usual case — puts the sentence at the caret.
   */
  onFinal: ((text: string) => void) | null
}

/**
 * The capture, which is not state: it holds a `MediaStream` and an `AudioContext`, neither of
 * which any render reads. Kept beside the store rather than in it, the way `stores/peaks.ts`
 * keeps its pending set outside — a re-render per audio chunk would be ten a second.
 */
let capture: Capture | null = null

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
  onFinal: null,

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    let pushed = false
    const stop = bridge.dictation.onEvent(event => {
      pushed = true

      if (event.type === 'state') {
        // A session that ends stops the microphone even when the ending came from the main
        // process — an engine that crashed leaves a capture nobody is reading.
        if (event.state !== 'listening') void closeCapture()
        set({ state: event.state, ...(event.state === 'listening' ? { partial: '' } : {}) })
        return
      }

      if (event.type === 'partial') set({ partial: event.text })
      else if (event.type === 'final') {
        set({ partial: '' })
        // Whoever asked to be told, or the field the caret is in — which is what makes
        // dictation work in every input of the studio without any of them being rewritten.
        const listener = get().onFinal
        if (listener) listener(event.text)
        else insertAtCaret(event.text)
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

    set({ failure: null })
    await bridge.dictation.start()

    // Only once the main process says it is listening: the model may be missing, or the
    // microphone refused, and opening a stream then would ask for a device for nothing.
    if (get().state !== 'listening') return

    const chosen = useSettings.getState().settings.dictation.inputDeviceId

    try {
      capture = await startCapture({
        ...(chosen ? { deviceId: chosen } : {}),
        onChunk: chunk => {
          // `Int16Array` over a plain `ArrayBuffer`, so its buffer is one: only a shared buffer
          // would not be, and nothing here makes one.
          void bridge.dictation.push(chunk.buffer as ArrayBuffer)
        },
        onLevel: level => set({ level }),
      })
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

async function closeCapture(): Promise<void> {
  const running = capture
  capture = null
  useDictation.setState({ level: 0 })
  await running?.stop()
}
