import { describe, expect, it, vi } from 'vitest'
import { localModel } from '@shared/domain/localModel-fixtures'
import type { PythonClient } from './pythonClient'
import type { EngineSettledJob } from './pythonProtocol'
import { pythonRuntime, type PythonRuntimeDeps } from './pythonRuntime'

const MODEL = localModel({
  id: 'sana',
  loader: 'diffusers',
  format: 'safetensors',
  modality: 'image',
})

const settled = (over: Partial<EngineSettledJob> = {}): EngineSettledJob => ({
  v: 1,
  evt: 'job.completed',
  job: 'local_1',
  ...over,
})

function harness(over: Partial<PythonClient> = {}, deps: Partial<PythonRuntimeDeps> = {}) {
  // Wrapped rather than defaulted: a test that supplies its own answer must still be the one the
  // spy records, or the assertion reads a call nobody made.
  const answers = over.job ?? (() => Promise.resolve(settled()))
  const job = vi.fn(answers)
  const memory = vi.fn(over.memory ?? (() => Promise.resolve([])))

  const client = { ...over, job, memory } as unknown as PythonClient

  const runtime = pythonRuntime({
    folderFor: model => `/models/${model.id}`,
    isComplete: () => Promise.resolve(true),
    fetch: () => Promise.resolve(),
    removeFiles: () => Promise.resolve(),
    engine: () => Promise.resolve(client),
    running: () => client,
    log: () => {},
    ...deps,
  })

  return { runtime, job, memory }
}

describe('reading what the engine holds', () => {
  /**
   * The LEDGER and never `worker.status`: asking a door would fork a Python process and pay 682 MB
   * of imports to be told it holds nothing.
   */
  it('asks the core rather than waking a door', async () => {
    const held = harness()
    await held.runtime.read([MODEL])

    expect(held.memory).toHaveBeenCalled()
    expect(held.job).not.toHaveBeenCalled()
  })

  /**
   * Measured 2026-08-22: forking the interpreter and reading `engine.hello` costs 28,8 ms,
   * median of five. A reading runs on every window that connects, and paying that to be told
   * nothing is loaded is a start-up nobody asked for.
   */
  it('never starts the engine to answer what is on the disk', async () => {
    const started = vi.fn(() => Promise.resolve(null))
    const { runtime } = harness({}, { engine: started, running: () => null })

    await runtime.read([MODEL])

    expect(started).not.toHaveBeenCalled()
  })

  /**
   * `ready` follows the DISK and not the process: a model is installable whether or not a Python
   * process happens to be running, and reading `false` here would grey out the install button of
   * a runtime that is perfectly able to install.
   */
  it('is ready with no engine running, because installing needs none', async () => {
    const { runtime } = harness({}, { running: () => null })

    expect(await runtime.read([MODEL])).toMatchObject({ ready: true, loaded: null })
  })

  it('holds nothing before a load', async () => {
    const { runtime } = harness()

    expect((await runtime.read([MODEL])).loaded).toBeNull()
  })

  it('names what it loaded once a door holds bytes for it', async () => {
    const doors = [
      { door: 'engine/diffusion', tensorBytes: 1, heldBytes: 2, device: 'mps', backend: 'pytorch' },
    ]
    const held = harness({ memory: () => Promise.resolve(doors) })

    await held.runtime.load?.(MODEL, { onProgress: () => {} })

    expect((await held.runtime.read([MODEL])).loaded).toBe('sana')
  })

  /** The id alone survives an engine that died; the ledger alone cannot name what is resident. */
  it('forgets what it loaded once no door holds anything', async () => {
    const held = harness()
    await held.runtime.load?.(MODEL, { onProgress: () => {} })

    expect((await held.runtime.read([MODEL])).loaded).toBeNull()
  })
})

describe('loading', () => {
  it('hands the door the folder the studio wrote the weights into', async () => {
    const held = harness()
    await held.runtime.load?.(MODEL, { onProgress: () => {} })

    expect(held.job).toHaveBeenCalledWith(
      'models.load',
      { modelId: 'sana', folder: '/models/sana' },
      expect.anything(),
    )
  })

  /** A MEASUREMENT, where `reservationBytes` is only what a publisher announced — R3. */
  it('answers what the door measured rather than what the manifest announced', async () => {
    const held = harness({ job: () => Promise.resolve(settled({ heldBytes: 7_766_163_456 })) })

    expect(await held.runtime.load?.(MODEL, { onProgress: () => {} })).toBe(7_766_163_456)
  })

  it('falls back to the reservation when the backend answered no figure', async () => {
    const held = harness()

    expect(await held.runtime.load?.(MODEL, { onProgress: () => {} })).toBe(MODEL.reservationBytes)
  })

  it('refuses readably when the engine is not answering', async () => {
    const { runtime } = harness({}, { engine: () => Promise.resolve(null) })

    await expect(runtime.load?.(MODEL, { onProgress: () => {} })).rejects.toThrow(/not answering/)
  })
})

describe('generating', () => {
  const request = {
    model: 'sana',
    prompt: 'a red cube',
    fields: { steps: 8 },
    destination: '/tmp/out.png',
    onProgress: () => {},
  }

  it('hands the door the prompt, the form and where to write', async () => {
    const held = harness({ job: () => Promise.resolve(settled({ path: '/tmp/out.png' })) })
    await held.runtime.generate?.(request)

    expect(held.job).toHaveBeenCalledWith(
      'generate',
      { steps: 8, prompt: 'a red cube', destination: '/tmp/out.png' },
      expect.anything(),
    )
  })

  /** A model that fell back to the CPU is indistinguishable from a slow machine unless it is said. */
  it('answers what actually ran it', async () => {
    const held = harness({
      job: () =>
        Promise.resolve(settled({ path: '/tmp/out.png', device: 'mps', backend: 'pytorch' })),
    })

    expect(await held.runtime.generate?.(request)).toEqual({
      path: '/tmp/out.png',
      device: 'mps',
      backend: 'pytorch',
    })
  })

  it('says it does not know rather than naming a device the door never reported', async () => {
    const held = harness({ job: () => Promise.resolve(settled({ path: '/tmp/out.png' })) })

    expect(await held.runtime.generate?.(request)).toMatchObject({ device: 'unknown' })
  })

  /** A generation that answered no path produced nothing, and filing nothing would be worse. */
  it('refuses an answer that carries no path', async () => {
    const held = harness()

    await expect(held.runtime.generate?.(request)).rejects.toThrow(/no path/)
  })
})
