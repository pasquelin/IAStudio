import type { MemorySnapshot } from '@shared/domain/aiMemory'
import type { AiOverview } from '@shared/domain/aiOverview'
import { STT_MODEL } from '@shared/domain/dictation'
import type { LocalModel } from '@shared/domain/localModel'
import { GIBI } from '@shared/domain/localModel-fixtures'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { describe, expect, it, vi } from 'vitest'
import type { HardwareFacts } from './hardwareProbe'
import type { LocalRuntime } from './localRuntimes'
import { createAiManager, type ManagerDeps } from './manager'

const FACTS: HardwareFacts = {
  platform: 'linux',
  arch: 'x64',
  cpuCount: 8,
  physicalBytes: 96 * GIBI,
  freeBytes: 34 * GIBI,
  diskFreeBytes: 500 * GIBI,
  gpu: null,
  vram: null,
}

const SNAPSHOT: MemorySnapshot = {
  domain: 'unified',
  source: 'probe',
  at: 0,
  physicalBytes: 96 * GIBI,
  appBudgetBytes: 48 * GIBI,
  rendererReservedBytes: GIBI,
  runtimeBytes: {},
  headroomBytes: 2 * GIBI,
  availableBytes: 34 * GIBI,
}

/** A runtime that installs nothing and holds nothing — what most of these cases need behind them. */
const idleRuntime = (install: LocalRuntime['install'] = () => Promise.resolve()): LocalRuntime => ({
  read: () => Promise.resolve({ ready: true, installed: new Set<string>(), loaded: new Set() }),
  install,
  remove: () => Promise.resolve(),
})

const manager = (over: Partial<ManagerDeps> = {}) =>
  createAiManager({
    facts: () => Promise.resolve(FACTS),
    snapshotOf: () => SNAPSHOT,
    settings: () => DEFAULT_SETTINGS,
    writeSettings: () => undefined,
    currentProjectPath: () => null,
    readyClouds: () => [],
    runtimes: { 'sherpa-onnx': idleRuntime(), ollama: idleRuntime() },
    emit: () => {},
    log: () => {},
    now: () => 0,
    idleUnloadMinutes: () => 0,
    ollamaInstalled: () => false,
    installOllama: () => Promise.resolve(),
    engineMissing: () => Promise.resolve(null),
    installEngine: () => Promise.resolve(),
    ...over,
  })

const other = (id: string): LocalModel => ({ ...STT_MODEL, id })

/** One candidate of the whole overview, whichever row holds it. */
const candidateOf = (overview: AiOverview, modelId: string) =>
  overview.roles.flatMap(row => row.candidates).find(one => one.model.id === modelId)

const holdingRuntime = (over: Partial<LocalRuntime> = {}): LocalRuntime => {
  const held = new Set<string>()

  return {
    read: models =>
      Promise.resolve({
        ready: true,
        installed: new Set(models.map(model => model.id)),
        loaded: new Set(models.filter(model => held.has(model.id)).map(model => model.id)),
      }),
    install: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    load: (model, options) => {
      options.onProgress(0.5)
      held.add(model.id)
      return Promise.resolve(3 * GIBI)
    },
    unload: () => {
      held.clear()
      return Promise.resolve()
    },
    ...over,
  }
}

/** A machine whose runtime ANSWERED for its memory — the only kind an admission may weigh. */
const runtimeSnapshot = (availableBytes: number): MemorySnapshot => ({
  ...SNAPSHOT,
  source: 'runtime',
  availableBytes,
})

describe('holding a model in memory', () => {
  const QWEN = STT_MODEL

  /**
   * "Activate" means RESIDENT, never hidden — ADR-21 § D. What the runtime measured is what is
   * remembered: `reservationBytes` is only what a publisher announced.
   */
  it('holds the weights, says so, and gives them back', async () => {
    const ai = manager({ runtimes: { 'sherpa-onnx': holdingRuntime() } })

    await ai.load(QWEN.id)
    const held = await ai.overview()
    expect(candidateOf(held, QWEN.id)?.loaded).toBe(true)

    await ai.unload(QWEN.id)
    expect(candidateOf(await ai.overview(), QWEN.id)?.loaded).toBe(false)
  })

  it('does not reload a model that is already on its door', async () => {
    const runtime = holdingRuntime()
    const load = vi.fn(runtime.load)
    const ai = manager({ runtimes: { 'sherpa-onnx': { ...runtime, load } } })

    await ai.ensureLoaded(QWEN.id)
    await ai.ensureLoaded(QWEN.id)

    expect(load).toHaveBeenCalledOnce()
  })

  it('loads the model the form named when another is on that door', async () => {
    const extra = other('whisper')
    const runtime = holdingRuntime()
    const load = vi.fn(runtime.load)
    const ai = manager({
      settings: () => ({
        ...DEFAULT_SETTINGS,
        ai: { ...DEFAULT_SETTINGS.ai, ownModels: [QWEN, extra] },
      }),
      runtimes: { 'sherpa-onnx': { ...runtime, load } },
    })

    await ai.ensureLoaded(QWEN.id)
    await ai.ensureLoaded(extra.id)

    expect(load.mock.calls.map(call => call[0].id)).toEqual([QWEN.id, extra.id])
  })

  it('refuses to generate when the machine has no room', async () => {
    const ai = manager({
      runtimes: { 'sherpa-onnx': holdingRuntime() },
      snapshotOf: () => runtimeSnapshot(GIBI / 2),
    })

    await expect(ai.ensureLoaded(QWEN.id)).rejects.toThrow(/needs/)
  })

  it('unloads a model left idle when nothing is using it', async () => {
    const armed: { run: (() => void) | null } = { run: null }
    const unload = vi.fn()
    const runtime = holdingRuntime()
    const ai = manager({
      idleUnloadMinutes: () => 10,
      schedule: (run, ms) => {
        expect(ms).toBe(10 * 60_000)
        armed.run = run
        return () => {
          armed.run = null
        }
      },
      runtimes: {
        'sherpa-onnx': {
          ...runtime,
          unload: async () => {
            unload()
            await runtime.unload?.()
          },
        },
      },
    })

    await ai.load(QWEN.id)
    armed.run?.()
    await vi.waitFor(() => expect(unload).toHaveBeenCalledOnce())
    expect(candidateOf(await ai.overview(), QWEN.id)?.loaded).toBe(false)
  })

  it('does not unload a model while a job holds it', async () => {
    const armed: { run: (() => void) | null } = { run: null }
    const unload = vi.fn()
    const runtime = holdingRuntime()
    const ai = manager({
      idleUnloadMinutes: () => 10,
      schedule: (run, _ms) => {
        armed.run = run
        return () => {
          armed.run = null
        }
      },
      runtimes: {
        'sherpa-onnx': {
          ...runtime,
          unload: async () => {
            unload()
            await runtime.unload?.()
          },
        },
      },
    })

    await ai.load(QWEN.id)
    const release = ai.hold(QWEN.id)
    armed.run?.()
    await Promise.resolve()
    expect(unload).not.toHaveBeenCalled()
    expect(candidateOf(await ai.overview(), QWEN.id)?.loaded).toBe(true)

    release()
    armed.run?.()
    await vi.waitFor(() => expect(unload).toHaveBeenCalledOnce())
  })

  /**
   * 🛑 The failure has to be READABLE — "8 GB asked for, 3 GB free" — and never a freeze. The two
   * figures are the ones the admission weighed, not a second reading taken afterwards.
   */
  it('refuses a model beyond the machine with both figures, rather than trying it', async () => {
    const load = vi.fn(() => Promise.resolve(0))
    const ai = manager({
      runtimes: { 'sherpa-onnx': holdingRuntime({ load }) },
      snapshotOf: () => runtimeSnapshot(GIBI / 2),
    })

    const after = await ai.load(QWEN.id)

    expect(after.loadFailure).toEqual({
      modelId: QWEN.id,
      neededBytes: QWEN.reservationBytes,
      availableBytes: GIBI / 2,
      reason: 'beyond-machine',
    })
    expect(load).not.toHaveBeenCalled()
  })

  /**
   * R1 of ADR-19: a probe reading may never admit a job. With no runtime answering for the memory
   * the load is ATTEMPTED and the runtime does the refusing — which is still readable, and is not
   * the same thing as deciding on a figure nobody measured.
   */
  it('tries the load where no runtime answered for the memory', async () => {
    const load = vi.fn(() => Promise.resolve(3 * GIBI))
    const ai = manager({ runtimes: { 'sherpa-onnx': holdingRuntime({ load }) } })

    await ai.load(QWEN.id)

    expect(load).toHaveBeenCalledOnce()
  })

  // A load of a fourteen-billion-parameter model is tens of seconds of disk. Invariant 6: it
  // reports, and it stops.
  it('reports how far a load has got, and stops when asked', async () => {
    const seen: (number | undefined)[] = []
    let stop: (() => void) | undefined
    const ai = manager({
      emit: overview => seen.push(overview.loading?.ratio),
      runtimes: {
        'sherpa-onnx': holdingRuntime({
          load: (_model, options) => {
            options.onProgress(0.25)
            return new Promise<number>((_ok, no) => {
              stop = () => no(new Error('aborted'))
              options.signal?.addEventListener('abort', () => stop?.())
            })
          },
        }),
      },
    })

    const loading = ai.load(QWEN.id)
    await vi.waitFor(() => expect(seen).toContain(0.25))
    await ai.cancelLoad()
    await loading

    expect((await ai.overview()).loading).toBeNull()
    expect((await ai.overview()).loadFailure?.reason).toBe('failed')
  })

  it('refuses to load a model whose files are not on disk, rather than asking the engine', async () => {
    const load = vi.fn(() => Promise.resolve(0))
    const after = await manager({
      runtimes: { 'sherpa-onnx': { ...idleRuntime(), load } },
    }).load(STT_MODEL.id)

    expect(after.loadFailure).toEqual({ reason: 'incomplete', modelId: STT_MODEL.id })
    expect(load).not.toHaveBeenCalled()
  })
})
