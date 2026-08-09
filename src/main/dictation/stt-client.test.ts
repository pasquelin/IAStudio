import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSttClient, type SttListeners, type SttPort } from './stt-client'
import type { SttMessage, SttResponse } from './stt-protocol'

function harness() {
  const sent: SttMessage[] = []
  let deliver: ((response: SttResponse) => void) | null = null
  let die: ((error: Error) => void) | null = null
  let throwOnSend = false

  const port: SttPort = {
    postMessage: message => {
      if (throwOnSend) throw new Error('the channel is closed')
      sent.push(message)
    },
    onMessage: listener => {
      deliver = listener
    },
    onFailure: listener => {
      die = listener
    },
    kill: vi.fn(),
  }

  const listeners: SttListeners = {
    onPartial: vi.fn(),
    onFinal: vi.fn(),
    onFailure: vi.fn(),
  }

  return {
    client: createSttClient(port, listeners),
    port,
    listeners,
    sent,
    reply: (response: SttResponse) => deliver?.(response),
    crash: (error: Error) => die?.(error),
    breakChannel: () => {
      throwOnSend = true
    },
  }
}

const loading = {
  encoder: '/models/encoder.onnx',
  decoder: '/models/decoder.onnx',
  joiner: '/models/joiner.onnx',
  tokens: '/models/tokens.txt',
  vad: '/resources/silero.onnx',
  threads: 2,
  silenceMs: 600,
  previewMs: 700,
}

describe('the load handshake', () => {
  // Reading 640 MB of weights can fail, and it has to fail at the opening rather than at the
  // first sentence — the same handshake the catalogue thread waits on.
  it('resolves only once the engine says it is up', async () => {
    const { client, sent, reply } = harness()

    const settled = vi.fn()
    const load = client.load(loading).then(settled)

    expect(sent).toEqual([{ load: true, ...loading }])
    expect(settled).not.toHaveBeenCalled()

    reply({ ready: true })
    await load
    expect(settled).toHaveBeenCalled()
  })

  it('rejects with what the engine could not do', async () => {
    const { client, reply } = harness()

    const load = client.load(loading)
    reply({ ready: false, error: 'encoder.onnx is not an ONNX file' })

    await expect(load).rejects.toThrow('encoder.onnx is not an ONNX file')
  })

  it('rejects when the process dies mid-load', async () => {
    const { client, crash } = harness()

    const load = client.load(loading)
    crash(new Error('exited with code 1'))

    await expect(load).rejects.toThrow('exited with code 1')
  })

  it('refuses to load through a process already known to be gone', async () => {
    const { client, crash } = harness()

    crash(new Error('exited with code 9'))

    await expect(client.load(loading)).rejects.toThrow('the recognition process is gone')
  })
})

describe('a running session', () => {
  let harnessed: ReturnType<typeof harness>

  beforeEach(async () => {
    harnessed = harness()
    const load = harnessed.client.load(loading)
    harnessed.reply({ ready: true })
    await load
    harnessed.sent.length = 0
  })

  it('passes audio straight through', () => {
    harnessed.client.push(new Int16Array([1, 2, 3]))

    expect(harnessed.sent).toEqual([{ audio: new Int16Array([1, 2, 3]) }])
  })

  it('reports a running hypothesis and a settled sentence', () => {
    harnessed.reply({ partial: 'un phare' })
    harnessed.reply({ final: 'Un phare rouge.', latencyMs: 420 })

    expect(harnessed.listeners.onPartial).toHaveBeenCalledWith('un phare')
    expect(harnessed.listeners.onFinal).toHaveBeenCalledWith('Un phare rouge.', 420)
  })

  // The words are gone either way, and a warning mid-sentence would be noise on top of a
  // machine already struggling. It goes to the log, and nowhere near the interface.
  it('does not tell the session about dropped audio', () => {
    harnessed.reply({ dropped: 16_000 })

    expect(harnessed.listeners.onFailure).not.toHaveBeenCalled()
    expect(harnessed.listeners.onPartial).not.toHaveBeenCalled()
  })

  it('reports a failure that arrives after the engine had loaded', () => {
    harnessed.reply({ failed: 'the decoder refused a segment' })

    expect(harnessed.listeners.onFailure).toHaveBeenCalledWith(
      new Error('the decoder refused a segment'),
    )
  })

  it('reports the process dying', () => {
    harnessed.crash(new Error('exited with code 139'))

    expect(harnessed.listeners.onFailure).toHaveBeenCalledWith(new Error('exited with code 139'))
  })

  // A dead process swallows `postMessage` without a word, so audio pushed into one would look
  // like a microphone nobody is listening to.
  it('stops sending once the process is gone', () => {
    harnessed.crash(new Error('gone'))
    harnessed.client.push(new Int16Array([1]))
    harnessed.client.flush()

    expect(harnessed.sent).toEqual([])
  })

  it('reports a channel that throws, rather than losing the session in silence', () => {
    harnessed.breakChannel()
    harnessed.client.push(new Int16Array([1]))

    expect(harnessed.listeners.onFailure).toHaveBeenCalledWith(new Error('the channel is closed'))
  })

  it('sends the three session commands', () => {
    harnessed.client.flush()
    harnessed.client.cancel()
    harnessed.client.unload()

    expect(harnessed.sent).toEqual([{ flush: true }, { cancel: true }, { unload: true }])
  })

  it('kills the process on close, and sends nothing after', () => {
    harnessed.client.close()
    harnessed.client.push(new Int16Array([1]))

    expect(harnessed.port.kill).toHaveBeenCalled()
    expect(harnessed.sent).toEqual([])
  })
})
