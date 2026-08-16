import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SttEvent, SttState } from '@shared/domain/dictation'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { MicrophoneRefused, NoInputDevice } from '@/dictation/capture'
import { registerDictationTarget } from '@/dictation/destination'
import { useDictation } from './dictation'
import { useSettings } from './settings'

const stop = vi.fn(() => Promise.resolve())
const startCapture = vi.fn((_options: unknown) => Promise.resolve({ stop }))

// jsdom has no `getUserMedia` and no audio graph: what is under test is what the store does
// with a capture, not the capture itself.
vi.mock('@/dictation/capture', async importActual => {
  // The real module is kept for the two error classes: the store tells them apart, so a
  // stand-in would be testing the stand-in.
  const actual = await importActual<Record<string, unknown>>()
  return {
    ...actual,
    startCapture: (options: unknown) => startCapture(options),
    listInputDevices: () => Promise.resolve([{ id: 'usb', label: 'Casque USB' }]),
  }
})

/** Installs a bridge and hands back the way to push an event through it. */
function connected(overrides: Record<string, unknown> = {}) {
  let emit: ((event: SttEvent) => void) | null = null
  // What the main process would answer if asked right now. Kept because `start` asks it rather
  // than reading the store: the two channels are not ordered, and a fake that always answered
  // `idle` would describe a main process that never starts.
  let held: SttState = 'idle'

  const bridge = installFakeBridge({
    dictation: {
      onEvent: (callback: (event: SttEvent) => void) => {
        emit = callback
        return () => {}
      },
      state: () => Promise.resolve({ state: held, partial: '', failure: null, download: null }),
      ...overrides,
    },
  })

  return {
    bridge,
    emit: (event: SttEvent) => {
      if (event.type === 'state') held = event.state
      emit?.(event)
    },
  }
}

beforeEach(async () => {
  // The capture is a module-level `let`, as it must be — it holds a `MediaStream` no render
  // reads. One left open by a previous test would make the next `start` return early.
  installFakeBridge()
  await useDictation.getState().stop()

  vi.clearAllMocks()
  startCapture.mockImplementation(() => Promise.resolve({ stop }))
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({
    state: 'idle',
    partial: '',
    level: 0,
    download: null,
    failure: null,
    devices: [],
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('following the session', () => {
  it('reads the state it missed and then follows the events', async () => {
    const { emit } = connected({
      state: () => Promise.resolve({ state: 'ready', download: null, failure: null }),
    })

    await useDictation.getState().connect()
    expect(useDictation.getState().state).toBe('ready')

    emit({ type: 'state', state: 'listening' })
    expect(useDictation.getState().state).toBe('listening')
  })

  // The snapshot was asked for before the event arrived; letting it land afterwards would show
  // a state that has already been left.
  it('lets an event that arrived first win over the snapshot', async () => {
    const { emit } = connected({
      state: () =>
        new Promise(resolve => {
          emit({ type: 'state', state: 'listening' })
          resolve({ state: 'idle', download: null, failure: null })
        }),
    })

    await useDictation.getState().connect()

    expect(useDictation.getState().state).toBe('listening')
  })

  it('keeps following when the state cannot be read at all', async () => {
    const { emit } = connected({ state: () => Promise.reject(new Error('no answer')) })

    await useDictation.getState().connect()
    emit({ type: 'state', state: 'ready' })

    expect(useDictation.getState().state).toBe('ready')
  })

  it('shows the running hypothesis, and clears it once the sentence settles', async () => {
    const { emit } = connected()
    await useDictation.getState().connect()

    emit({ type: 'partial', text: 'un phare' })
    expect(useDictation.getState().partial).toBe('un phare')

    emit({ type: 'final', text: 'Un phare rouge.', latencyMs: 300 })
    expect(useDictation.getState().partial).toBe('')
  })

  it('follows the download and the failures', async () => {
    const { emit } = connected()
    await useDictation.getState().connect()

    emit({ type: 'download', progress: { received: 10, total: 100 } })
    expect(useDictation.getState().download).toEqual({ received: 10, total: 100 })

    emit({ type: 'error', failure: { code: 'engineCrashed', message: 'gone' } })
    expect(useDictation.getState().failure?.code).toBe('engineCrashed')
  })
})

describe('where a settled sentence goes', () => {
  // The whole point: no field of the studio was rewritten, and none of them knows dictation
  // exists — the sentence goes where the caret is.
  it('lands at the caret of the field that has the focus', async () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()

    const { emit } = connected()
    await useDictation.getState().connect()
    emit({ type: 'final', text: 'Un phare rouge.', latencyMs: 300 })

    expect(input.value).toBe('Un phare rouge.')
    input.remove()
  })

  /**
   * The one thing talking to the studio changed about dictation — and it changed it here rather
   * than in a branch on who is on screen. This session knows only that somebody may have claimed
   * the words; which surface, and while it is up, is that surface's business.
   */
  it('goes to whoever claimed the words instead, when somebody has', async () => {
    const claimed: string[] = []
    const release = registerDictationTarget(text => claimed.push(text))

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()

    const { emit } = connected()
    await useDictation.getState().connect()
    emit({ type: 'final', text: 'ouvre un fichier 3D', latencyMs: 300 })

    expect(claimed).toEqual(['ouvre un fichier 3D'])
    expect(input.value).toBe('')
    release()
    input.remove()
  })
})

describe('starting and stopping', () => {
  it('opens the microphone only once the main process is listening', async () => {
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()

    await useDictation.getState().start()

    expect(startCapture).toHaveBeenCalled()
  })

  /**
   * The first press of a session crosses `loadingEngine` on its way to `listening` — the
   * 700 MB are only read once, so every later press goes straight through. That one event used
   * to end the session the press had just opened, and the microphone stayed shut under a button
   * that said it was listening. Turning it off and on again worked, which is how it was found.
   */
  it('opens the microphone when the engine had to be loaded first', async () => {
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'loadingEngine' })
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()

    await useDictation.getState().start()

    expect(startCapture).toHaveBeenCalled()
  })

  // The model may be missing or the microphone refused: asking the platform for a device then
  // would put a recording indicator on screen for a session that never happens.
  it('opens nothing when the session did not start', async () => {
    connected({ start: () => Promise.resolve() })
    await useDictation.getState().connect()

    await useDictation.getState().start()

    expect(startCapture).not.toHaveBeenCalled()
  })

  it('records the refusal the platform gave, told apart from a missing device', async () => {
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()

    startCapture.mockRejectedValueOnce(new MicrophoneRefused('refused'))
    await useDictation.getState().start()
    expect(useDictation.getState().failure?.code).toBe('permissionDenied')

    emit({ type: 'state', state: 'listening' })
    startCapture.mockRejectedValueOnce(new NoInputDevice('none'))
    await useDictation.getState().start()
    expect(useDictation.getState().failure?.code).toBe('noInputDevice')
  })

  /**
   * `capture` is only assigned once the device has opened, and a stop landing before that found
   * nothing to close: the stream came up behind it with the recording light on, and — being
   * truthy — turned every later start into an immediate return. Dictation was over for the rest
   * of the session, microphone included.
   */
  it('closes a microphone that finished opening after the session ended', async () => {
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()

    let openDevice = (): void => {}
    startCapture.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          openDevice = () => resolve({ stop })
        }),
    )

    const starting = useDictation.getState().start()
    // Stopped while the device is still opening — the window the guard used to miss entirely.
    await vi.waitFor(() => expect(startCapture).toHaveBeenCalled())
    await useDictation.getState().stop()
    openDevice()
    await starting

    expect(stop).toHaveBeenCalled()

    // And the next press is served rather than swallowed by a capture nobody can reach.
    await useDictation.getState().start()

    expect(startCapture).toHaveBeenCalledTimes(2)
  })

  it('closes the microphone on stop, and drops the level with it', async () => {
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()
    await useDictation.getState().start()
    useDictation.setState({ level: 0.8 })

    await useDictation.getState().stop()

    expect(stop).toHaveBeenCalled()
    expect(useDictation.getState().level).toBe(0)
  })

  // An engine that crashed leaves a window holding an open microphone nobody is reading — and
  // the operating system showing a recording indicator for it.
  it('closes the microphone when the session ends from the other side', async () => {
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()
    await useDictation.getState().start()

    emit({ type: 'error', failure: { code: 'engineCrashed', message: 'gone' } })
    emit({ type: 'state', state: 'error' })

    expect(stop).toHaveBeenCalled()
  })

  it('records from the microphone the settings name', async () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        dictation: { ...DEFAULT_SETTINGS.dictation, inputDeviceId: 'usb' },
      },
    })
    const { emit } = connected({
      start: () => {
        emit({ type: 'state', state: 'listening' })
        return Promise.resolve()
      },
    })
    await useDictation.getState().connect()

    await useDictation.getState().start()

    expect(startCapture).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'usb' }))
  })
})

describe('the microphones on offer', () => {
  it('reads what the machine has', async () => {
    await useDictation.getState().refreshDevices()

    expect(useDictation.getState().devices).toEqual([{ id: 'usb', label: 'Casque USB' }])
  })
})
