import { describe, expect, it, vi } from 'vitest'
import type { SttEvent } from '@shared/domain/dictation'
import { ChecksumMismatch } from './model-download'
import { createSession, MAX_RESTARTS, type EngineListeners, type SessionHost } from './session'
import type { SttClient } from './stt-client'

function harness(overrides: Partial<SessionHost> = {}) {
  const events: SttEvent[] = []
  const timers: { run: () => void; delayMs: number }[] = []
  let captured: EngineListeners | null = null
  let onExit: (() => void) | null = null
  let loadFails: string | null = null

  const engine: SttClient = {
    load: () => (loadFails ? Promise.reject(new Error(loadFails)) : Promise.resolve()),
    push: vi.fn(),
    flush: vi.fn(),
    cancel: vi.fn(),
    unload: vi.fn(),
    close: vi.fn(),
  }

  const opened = vi.fn((listeners: EngineListeners, exit: () => void) => {
    captured = listeners
    onExit = exit
    return engine
  })

  const host: SessionHost = {
    modelFolder: () => '/models',
    vadPath: () => '/resources/silero.onnx',
    settings: () => ({ threads: 2, silenceMs: 600, previewMs: 700, idleUnloadMinutes: 10 }),
    modelIsReady: () => Promise.resolve(true),
    download: () => Promise.resolve(),
    requestMicrophone: () => Promise.resolve('granted'),
    openEngine: opened,
    emit: event => void events.push(event),
    log: vi.fn(),
    join: (folder, name) => `${folder}/${name}`,
    now: () => 0,
    schedule: (run, delayMs) => {
      timers.push({ run, delayMs })
      return () => {
        const at = timers.findIndex(timer => timer.run === run)
        if (at >= 0) timers.splice(at, 1)
      }
    },
    ...overrides,
  }

  return {
    session: createSession(host),
    events,
    engine,
    opened,
    timers,
    states: () => events.filter(event => event.type === 'state').map(event => event.state),
    crash: (error: Error) => captured?.onFailure(error),
    exit: () => onExit?.(),
    speak: (text: string) => captured?.onFinal(text, 300),
    failLoad: (reason: string) => {
      loadFails = reason
    },
  }
}

describe('starting a session', () => {
  it('loads the engine and listens', async () => {
    const { session, states, opened } = harness()

    await session.start()

    expect(states()).toEqual(['loadingEngine', 'listening'])
    expect(opened).toHaveBeenCalledTimes(1)
    expect(session.snapshot().state).toBe('listening')
  })

  it('keeps the engine between sessions rather than forking one each time', async () => {
    const { session, opened } = harness()

    await session.start()
    await session.stop()
    await session.start()

    expect(opened).toHaveBeenCalledTimes(1)
  })

  // Asked first, so the interface can tell "you said no" from "there is no microphone" — which
  // `getUserMedia` alone reports identically.
  it('stops at the permission, and says which refusal it was', async () => {
    const { session, states, events, opened } = harness({
      requestMicrophone: () => Promise.resolve('denied'),
    })

    await session.start()

    expect(states()).toEqual(['permissionRequired'])
    expect(opened).not.toHaveBeenCalled()
    expect(events).toContainEqual({
      type: 'error',
      failure: { code: 'permissionDenied', message: expect.any(String) },
    })
  })

  it('asks for the model rather than failing when it is not there', async () => {
    const { session, states, opened } = harness({ modelIsReady: () => Promise.resolve(false) })

    await session.start()

    expect(states()).toEqual(['modelMissing'])
    expect(opened).not.toHaveBeenCalled()
  })

  it('hands the engine the paths and the settings', async () => {
    const { session, engine } = harness()
    const load = vi.spyOn(engine, 'load')

    await session.start()

    expect(load).toHaveBeenCalledWith({
      encoder: '/models/encoder.int8.onnx',
      decoder: '/models/decoder.int8.onnx',
      joiner: '/models/joiner.int8.onnx',
      tokens: '/models/tokens.txt',
      vad: '/resources/silero.onnx',
      threads: 2,
      silenceMs: 600,
      previewMs: 700,
    })
  })
})

describe('a session that goes wrong', () => {
  it('reports an engine that could not load', async () => {
    const harnessed = harness()
    harnessed.failLoad('encoder.int8.onnx is not an ONNX file')

    await harnessed.session.start()

    expect(harnessed.session.snapshot().state).toBe('error')
    expect(harnessed.session.snapshot().failure?.code).toBe('engineCrashed')
  })

  // A process that dies on the first chunk would otherwise be forked again by the next one, for
  // as long as someone keeps speaking.
  it('gives up after three failed loads in a row', async () => {
    const harnessed = harness()
    harnessed.failLoad('the addon will not load')

    for (let attempt = 0; attempt < MAX_RESTARTS + 1; attempt += 1) await harnessed.session.start()

    expect(harnessed.opened).toHaveBeenCalledTimes(MAX_RESTARTS)
    expect(harnessed.session.snapshot().state).toBe('error')
  })

  it('counts from zero again once a session has actually worked', async () => {
    const { session, opened } = harness()

    await session.start()
    await session.stop()
    await session.start()

    expect(session.snapshot().failure).toBeNull()
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('reports the engine dying mid-sentence', async () => {
    const { session, crash } = harness()

    await session.start()
    crash(new Error('exited with code 139'))

    expect(session.snapshot().state).toBe('error')
    expect(session.snapshot().failure).toEqual({
      code: 'engineCrashed',
      message: 'exited with code 139',
    })
  })

  it('forks a new engine after a crash rather than staying deaf', async () => {
    const { session, crash, opened } = harness()

    await session.start()
    crash(new Error('gone'))
    await session.start()

    expect(opened).toHaveBeenCalledTimes(2)
    expect(session.snapshot().state).toBe('listening')
  })
})

describe('ending a session', () => {
  it('flushes on stop, so the last words are transcribed', async () => {
    const { session, engine } = harness()

    await session.start()
    await session.stop()

    expect(engine.flush).toHaveBeenCalled()
    expect(engine.cancel).not.toHaveBeenCalled()
    expect(session.snapshot().state).toBe('ready')
  })

  it('drops what was said on cancel', async () => {
    const { session, engine } = harness()

    await session.start()
    await session.cancel()

    expect(engine.cancel).toHaveBeenCalled()
    expect(engine.flush).not.toHaveBeenCalled()
  })

  it('passes audio only while listening', async () => {
    const { session, engine } = harness()

    session.push(new Int16Array([1]))
    await session.start()
    session.push(new Int16Array([2]))
    await session.stop()
    session.push(new Int16Array([3]))

    expect(engine.push).toHaveBeenCalledTimes(1)
    expect(engine.push).toHaveBeenCalledWith(new Int16Array([2]))
  })

  it('reports what was heard', async () => {
    const { session, events, speak } = harness()

    await session.start()
    speak('Un phare rouge.')

    expect(events).toContainEqual({ type: 'final', text: 'Un phare rouge.', latencyMs: 300 })
  })
})

describe('letting the model go', () => {
  it('drops the engine after a stretch of not dictating', async () => {
    const { session, engine, timers } = harness()

    await session.start()
    await session.stop()
    expect(timers).toHaveLength(1)
    expect(timers[0]!.delayMs).toBe(600_000)

    timers[0]!.run()

    expect(engine.close).toHaveBeenCalled()
    expect(session.snapshot().state).toBe('idle')
  })

  // The engine holds audio that has not been transcribed yet: letting it go mid-sentence would
  // lose the words between the last silence and now.
  it('never drops it while someone is speaking', async () => {
    const { session, engine, timers } = harness()

    await session.start()
    await session.stop()
    const idle = timers[0]!
    await session.start()
    idle.run()

    expect(engine.close).not.toHaveBeenCalled()
  })

  it('keeps it resident when the setting says never', async () => {
    const { session, timers } = harness({
      settings: () => ({ threads: 2, silenceMs: 600, previewMs: 700, idleUnloadMinutes: 0 }),
    })

    await session.start()
    await session.stop()

    expect(timers).toEqual([])
  })
})

describe('fetching the model', () => {
  it('reports progress and lands back at idle', async () => {
    const { session, events, states } = harness({
      download: async report => {
        report({ received: 10, total: 100 })
        report({ received: 100, total: 100 })
      },
    })

    await session.downloadModel()

    expect(states()).toEqual(['downloadingModel', 'idle'])
    expect(events).toContainEqual({ type: 'download', progress: { received: 100, total: 100 } })
  })

  it('holds the progress for a window that arrives mid-download', async () => {
    let seen = { received: 0, total: 0 }
    const { session } = harness({
      download: async report => {
        report({ received: 42, total: 100 })
        seen = { received: 42, total: 100 }
        await Promise.resolve()
      },
    })

    const running = session.downloadModel()
    expect(session.snapshot().state).toBe('downloadingModel')
    await running

    expect(seen).toEqual({ received: 42, total: 100 })
  })

  it('goes back to asking when the download is cancelled', async () => {
    const { session, states } = harness({
      download: (_report, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('cancelled')))
        }),
    })

    const running = session.downloadModel()
    session.cancelDownload()
    await running

    expect(states()).toEqual(['downloadingModel', 'modelMissing'])
  })

  // Told apart because they lead somewhere different: a network that failed is worth retrying,
  // a file that failed its digest was deleted and has to say so.
  it('names a corrupted model differently from a failed network', async () => {
    const corrupted = harness({
      download: () => Promise.reject(new ChecksumMismatch('encoder.int8.onnx is damaged')),
    })
    await corrupted.session.downloadModel()
    expect(corrupted.session.snapshot().failure?.code).toBe('modelChecksumMismatch')

    const offline = harness({ download: () => Promise.reject(new Error('network is unreachable')) })
    await offline.session.downloadModel()
    expect(offline.session.snapshot().failure?.code).toBe('modelDownloadFailed')
  })

  it('ignores a second request while one is already running', async () => {
    const download = vi.fn(() => Promise.resolve())
    const { session } = harness({ download })

    const first = session.downloadModel()
    const second = session.downloadModel()
    await Promise.all([first, second])

    expect(download).toHaveBeenCalledTimes(1)
  })
})

describe('disposing', () => {
  it('closes the engine and abandons a download in flight', async () => {
    let aborted = false
    const { session, engine } = harness({
      download: (_report, signal) =>
        new Promise(resolve => {
          signal.addEventListener('abort', () => {
            aborted = true
            resolve()
          })
        }),
    })

    await session.start()
    void session.downloadModel()
    session.dispose()

    expect(engine.close).toHaveBeenCalled()
    expect(aborted).toBe(true)
  })
})
