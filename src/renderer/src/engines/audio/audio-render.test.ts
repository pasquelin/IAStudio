import { describe, expect, it, vi } from 'vitest'
import type { AudioData } from './audio-data'
import {
  createAudioRenderer,
  handleRequest,
  type AudioWorkerRequest,
  type AudioWorkerResponse,
  type AudioWorkerState,
  type WorkerPort,
} from './audio-render'
import { encodeWav } from './wav'

function fakePort(): {
  port: WorkerPort
  sent: { message: AudioWorkerRequest; transfer: Transferable[] }[]
  reply: (response: AudioWorkerResponse) => void
  terminated: () => number
  fail: () => void
} {
  const sent: { message: AudioWorkerRequest; transfer: Transferable[] }[] = []
  const listeners: ((event: MessageEvent<AudioWorkerResponse>) => void)[] = []
  let terminated = 0

  const port: WorkerPort = {
    onerror: null,
    postMessage: (message, transfer) => {
      sent.push({ message, transfer })
    },
    addEventListener: (_type, listener) => {
      listeners.push(listener)
    },
    terminate: () => {
      terminated++
    },
  }

  return {
    port,
    sent,
    terminated: () => terminated,
    // `as`: the renderer only ever reads `data` off the event, and no MessageEvent constructor
    // is worth building one of for it.
    reply: response => {
      for (const listener of listeners)
        listener({ data: response } as MessageEvent<AudioWorkerResponse>)
    },
    fail: () => port.onerror?.(new ErrorEvent('error')),
  }
}

const take = (samples: number[]): AudioData => ({
  sampleRate: 48_000,
  channels: [new Float32Array(samples)],
})

describe('createAudioRenderer', () => {
  it('moves the take rather than copying it', () => {
    const { port, sent } = fakePort()
    const source = take([0, 0.5, 1])

    createAudioRenderer(() => port).load(source)

    expect(sent[0]?.message).toMatchObject({ kind: 'load', sampleRate: 48_000 })
    expect(sent[0]?.transfer).toEqual([source.channels[0]?.buffer])
  })

  it('resolves a render with what the worker sent back', async () => {
    const { port, reply } = fakePort()
    const renderer = createAudioRenderer(() => port)

    const pending = renderer.render([{ kind: 'gain', db: 3 }])
    const channels = [new Float32Array([0.25])]
    reply({ kind: 'rendered', id: 0, sampleRate: 48_000, channels, wav: new Uint8Array([1, 2]) })

    await expect(pending).resolves.toEqual({
      data: { sampleRate: 48_000, channels },
      wav: new Uint8Array([1, 2]),
    })
  })

  it('drops a render the user has already overtaken', async () => {
    const { port, reply } = fakePort()
    const renderer = createAudioRenderer(() => port)

    const first = renderer.render([{ kind: 'gain', db: 3 }])
    const second = renderer.render([{ kind: 'gain', db: 6 }])
    reply({
      kind: 'rendered',
      id: 1,
      sampleRate: 48_000,
      channels: [new Float32Array([0.5])],
      wav: new Uint8Array([9]),
    })

    await expect(first).resolves.toBeNull()
    await expect(second).resolves.not.toBeNull()
  })

  it('resolves rather than hanging when the worker reports a failure', async () => {
    const { port, reply } = fakePort()
    const pending = createAudioRenderer(() => port).render([])

    reply({ kind: 'failed', id: 0, message: 'no take loaded' })

    await expect(pending).resolves.toBeNull()
  })

  it('releases whoever is still waiting when the editor closes', async () => {
    const { port, terminated } = fakePort()
    const renderer = createAudioRenderer(() => port)

    const pending = renderer.render([])
    renderer.dispose()

    await expect(pending).resolves.toBeNull()
    expect(terminated()).toBe(1)
  })
})

describe('handleRequest', () => {
  it('answers a render with the chain applied and the bytes to write', () => {
    const state: AudioWorkerState = { source: null }
    handleRequest(state, { kind: 'load', sampleRate: 48_000, channels: [new Float32Array([1, 1])] })

    const answer = handleRequest(state, {
      kind: 'render',
      id: 4,
      edits: [{ kind: 'gain', db: -6 }],
    })

    expect(answer?.response.kind).toBe('rendered')
    if (answer?.response.kind !== 'rendered') throw new Error('expected a rendered response')
    expect(answer.response.id).toBe(4)
    expect(answer.response.channels[0]?.[0]).toBeCloseTo(0.501, 3)
    expect(answer.response.wav).toEqual(
      encodeWav({ sampleRate: 48_000, channels: answer.response.channels }),
    )
  })

  it('offers every returned buffer for transfer, and none of them twice', () => {
    const state: AudioWorkerState = { source: null }
    handleRequest(state, {
      kind: 'load',
      sampleRate: 48_000,
      channels: [new Float32Array([1, 0]), new Float32Array([0, 1])],
    })

    const answer = handleRequest(state, { kind: 'render', id: 0, edits: [{ kind: 'gain', db: 2 }] })

    expect(answer?.transfer).toHaveLength(3)
    expect(new Set(answer?.transfer).size).toBe(3)
  })

  it('keeps the source when the chain hands its input straight back', () => {
    const state: AudioWorkerState = { source: null }
    const channel = new Float32Array([0.5, 0.25])
    handleRequest(state, { kind: 'load', sampleRate: 48_000, channels: [channel] })

    const answer = handleRequest(state, { kind: 'render', id: 0, edits: [] })

    if (answer?.response.kind !== 'rendered') throw new Error('expected a rendered response')
    // An empty chain returns the source array itself; sending that one would detach the take.
    expect(answer.response.channels[0]).not.toBe(channel)
    expect(answer.transfer).not.toContain(channel.buffer)
    expect([...(answer.response.channels[0] ?? [])]).toEqual([0.5, 0.25])
  })

  it('renders again from the same source, having given none of it away', () => {
    const state: AudioWorkerState = { source: null }
    handleRequest(state, { kind: 'load', sampleRate: 48_000, channels: [new Float32Array([1, 1])] })

    handleRequest(state, { kind: 'render', id: 0, edits: [] })
    const second = handleRequest(state, {
      kind: 'render',
      id: 1,
      edits: [{ kind: 'gain', db: -6 }],
    })

    if (second?.response.kind !== 'rendered') throw new Error('expected a rendered response')
    expect(second.response.channels[0]?.[0]).toBeCloseTo(0.501, 3)
  })

  it('reports rather than throws when a render arrives before any take', () => {
    const answer = handleRequest({ source: null }, { kind: 'render', id: 2, edits: [] })
    expect(answer?.response).toEqual({ kind: 'failed', id: 2, message: 'no take loaded' })
  })

  it('sends nothing back for a load', () => {
    expect(
      handleRequest({ source: null }, { kind: 'load', sampleRate: 48_000, channels: [] }),
    ).toBeNull()
  })
})

describe('the worker entry', () => {
  it('posts what handleRequest answers, and stays quiet for a load', async () => {
    const posted = vi.fn()
    const listeners: ((event: MessageEvent<AudioWorkerRequest>) => void)[] = []
    vi.stubGlobal('self', {
      postMessage: posted,
      set onmessage(listener: (event: MessageEvent<AudioWorkerRequest>) => void) {
        listeners.push(listener)
      },
    })

    await import('./audio.worker')
    const deliver = (request: AudioWorkerRequest): void => {
      // `as`: only `data` is read, and the node project has no MessageEvent constructor.
      for (const listener of listeners)
        listener({ data: request } as MessageEvent<AudioWorkerRequest>)
    }

    deliver({ kind: 'load', sampleRate: 8_000, channels: [new Float32Array([1])] })
    expect(posted).not.toHaveBeenCalled()

    deliver({ kind: 'render', id: 7, edits: [] })
    expect(posted).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rendered', id: 7 }), {
      transfer: expect.any(Array),
    })

    vi.unstubAllGlobals()
  })
})

describe('the worker it opens', () => {
  it('waits for a take rather than spawning one on construction', () => {
    const open = vi.fn(() => fakePort().port)

    createAudioRenderer(open)

    // React runs a state initialiser twice and keeps one: a worker opened there would leak.
    expect(open).not.toHaveBeenCalled()
  })

  it('opens exactly one, however many takes and renders go through it', async () => {
    const { port, reply } = fakePort()
    const open = vi.fn(() => port)
    const renderer = createAudioRenderer(open)

    renderer.load(take([0, 1]))
    const pending = renderer.render([])
    reply({ kind: 'rendered', id: 0, sampleRate: 48_000, channels: [], wav: new Uint8Array() })
    await pending

    expect(open).toHaveBeenCalledTimes(1)
  })

  it('terminates nothing when the editor closes before a take arrives', () => {
    const { port, terminated } = fakePort()
    createAudioRenderer(() => port).dispose()

    expect(terminated()).toBe(0)
  })
})

describe('a worker that dies', () => {
  it('releases whoever was waiting rather than leaving the editor loading forever', async () => {
    const { port, fail } = fakePort()
    const renderer = createAudioRenderer(() => port)

    const pending = renderer.render([{ kind: 'normalize', targetLufs: -14 }])
    fail()

    await expect(pending).resolves.toBeNull()
  })

  it('opens a fresh one for the next take rather than talking to the dead one', () => {
    const first = fakePort()
    const second = fakePort()
    const ports = [first.port, second.port]
    const renderer = createAudioRenderer(() => ports.shift() ?? second.port)

    renderer.load(take([0, 1]))
    first.fail()
    renderer.load(take([1, 0]))

    expect(first.terminated()).toBe(1)
    expect(second.sent).toHaveLength(1)
  })
})
