import { describe, expect, it, vi } from 'vitest'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { MemorySnapshot } from '@shared/domain/aiMemory'
import { aiRoleId, DICTATION_ROLE } from '@shared/domain/aiRole'
import { STT_MODEL } from '@shared/domain/dictation'
import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
import { DEFAULT_SETTINGS, type PartialSettings, type Settings } from '@shared/domain/settings'
import type { HardwareFacts } from './hardwareProbe'
import { createAiManager, type ManagerDeps } from './manager'
import type { LocalRuntime, LocalRuntimes } from './localRuntimes'

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
  read: () => Promise.resolve({ ready: true, installed: new Set<string>(), loaded: null }),
  install,
  remove: () => Promise.resolve(),
})

/**
 * A download that hangs until the test lets it go, or until it is aborted.
 *
 * `begun` is what a test waits on before settling it: the manager starts the fetch a tick late,
 * so the lock is in place before anything can clear it.
 */
type Held = {
  runtimes: LocalRuntimes
  begun: Promise<void>
  report: (progress: DownloadProgress) => void
  settle: () => void
  fail: (error: Error) => void
  calls: () => number
}

const heldInstall = (): Held => {
  let resolve: (() => void) | undefined
  let reject: ((error: Error) => void) | undefined
  let tell: ((progress: DownloadProgress) => void) | undefined
  let started: () => void = () => {}
  let calls = 0

  return {
    begun: new Promise<void>(ok => {
      started = ok
    }),
    runtimes: {
      'sherpa-onnx': idleRuntime((_model, onProgress, signal) => {
        calls += 1
        tell = onProgress
        started()
        return new Promise<void>((ok, no) => {
          resolve = ok
          reject = no
          signal.addEventListener('abort', () => no(new Error('aborted')))
        })
      }),
    },
    report: progress => tell?.(progress),
    settle: () => resolve?.(),
    fail: error => reject?.(error),
    calls: () => calls,
  }
}

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
    ...over,
  })

const other = (id: string): LocalModel => ({ ...STT_MODEL, id })

const nothing = (_progress: DownloadProgress): void => {}

/** One candidate of the whole overview, whichever row holds it. */
const candidateOf = (overview: AiOverview, modelId: string) =>
  overview.roles.flatMap(row => row.candidates).find(one => one.model.id === modelId)

describe('the AI manager', () => {
  /**
   * The status line and the manager screen fetch the same files into the same folder. Two
   * streams onto one `.part` would fail a digest rather than a download, so the second caller
   * joins the first instead of opening one.
   */
  it('joins two callers asking for the same model onto one download', async () => {
    const held = heldInstall()
    const ai = manager({ runtimes: held.runtimes })

    const first = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    const second = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    held.settle()
    await Promise.all([first, second])

    expect(held.calls()).toBe(1)
  })

  it('refuses a second model while one is being fetched', async () => {
    const held = heldInstall()
    const ai = manager({ runtimes: held.runtimes })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    // Rejected rather than thrown: one channel for one failure, whatever the caller awaits on.
    await expect(ai.installModel(other('another'), nothing)).rejects.toThrow()

    await held.begun
    held.settle()
    await running
  })

  /**
   * A join that only shared the promise left the dictation status line at 0/0 with a cancel
   * button that did nothing, while the manager screen showed the same download moving.
   */
  it('reports to whoever joined, and lets them stop it', async () => {
    const held = heldInstall()
    const ai = manager({ runtimes: held.runtimes })
    const seen: number[] = []
    const mine = new AbortController()

    const first = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    const second = ai.installModel(STT_MODEL, step => seen.push(step.received), mine.signal)
    await held.begun

    held.report({ received: 7, total: 9 })
    expect(seen).toEqual([7])

    mine.abort()
    await expect(first).rejects.toThrow()
    await expect(second).rejects.toThrow()
  })

  // One lock, so a cancel from the manager screen reaches a download the status line began.
  it('cancels a download whatever asked for it', async () => {
    const held = heldInstall()
    const ai = manager({ runtimes: held.runtimes })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    await ai.cancelInstall()

    await expect(running).rejects.toThrow()
  })

  it('lets go of the lock when a download fails', async () => {
    const held = heldInstall()
    const ai = manager({ runtimes: held.runtimes })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    held.fail(new Error('network'))
    await expect(running).rejects.toThrow()

    // The second call is what the lock would have refused, had it stayed held.
    const again = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await Promise.resolve()
    held.settle()
    await again

    expect(held.calls()).toBe(2)
  })

  /**
   * A window asked, and what it needs back is the state the studio is in. The dictation session
   * takes the other door — `installModel` rethrows, so it can tell a broken digest from a
   * network that gave up.
   */
  it('answers a window with an overview rather than raising, where the session gets the error', async () => {
    const log = vi.fn()
    const ai = manager({
      runtimes: { 'sherpa-onnx': idleRuntime(() => Promise.reject(new Error('network'))) },
      log,
    })

    await expect(ai.install(STT_MODEL.id)).resolves.toMatchObject({ installing: null })
    await expect(
      ai.installModel(STT_MODEL, nothing, new AbortController().signal),
    ).rejects.toThrow()
    // On the WARN and its subject: every compose also logs an `info` for the loader nothing wires
    // here, so a bare `toHaveBeenCalled` stayed green with the failure's own line deleted.
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining(STT_MODEL.id))
  })

  /**
   * Removing is a NETWORK call for a runtime that pulls its own weights, where deleting files
   * barely ever failed. Raised, it reached a `void removeAiModel(…)` in the window and became an
   * unhandled rejection: nothing in the journal, no overview, the row still saying "installed".
   */
  it('answers a window with an overview when a removal fails, rather than raising', async () => {
    const log = vi.fn()
    const ai = manager({
      runtimes: {
        'sherpa-onnx': {
          ...idleRuntime(),
          remove: () => Promise.reject(new Error('delete refused: HTTP 500')),
        },
      },
      log,
    })

    await expect(ai.remove(STT_MODEL.id)).resolves.toMatchObject({ installing: null })
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining(STT_MODEL.id))
  })

  /**
   * Which project is open decides which choices apply, and nothing inside the manager sees that
   * change: a settings window left open would keep a stale path and stale badges.
   */
  it('re-publishes the overview against the project that is open now', async () => {
    const seen: (string | null)[] = []
    let path: string | null = null
    const ai = manager({
      currentProjectPath: () => path,
      emit: overview => seen.push(overview.projectPath),
    })

    path = '/projects/one'
    await ai.refresh()

    expect(seen).toEqual(['/projects/one'])
  })

  it('says which install is running, so a window that did not ask still follows it', async () => {
    const held = heldInstall()
    const ai = manager({ runtimes: held.runtimes })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    expect((await ai.overview()).installing?.modelId).toBe(STT_MODEL.id)

    held.settle()
    await running
    expect((await ai.overview()).installing).toBeNull()
  })
})

/**
 * A runtime that HOLDS a model — what an idle one deliberately cannot do, and what the two
 * gestures ADR-21 § D asks for are about.
 */
const holdingRuntime = (over: Partial<LocalRuntime> = {}): LocalRuntime => {
  let held: string | null = null

  return {
    read: models =>
      Promise.resolve({
        ready: true,
        installed: new Set(models.map(model => model.id)),
        loaded: held,
      }),
    install: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    load: (model, options) => {
      options.onProgress(0.5)
      held = model.id
      return Promise.resolve(3 * GIBI)
    },
    unload: () => {
      held = null
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

const withOwnModel = (model: LocalModel): Settings => ({
  ...DEFAULT_SETTINGS,
  ai: { ...DEFAULT_SETTINGS.ai, ownModels: [model] },
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
})

describe('a model the person supplied', () => {
  const OWN = localModel({
    id: 'own-abc',
    name: 'Their weights',
    rank: 3,
    loader: 'sherpa-onnx',
    files: [],
    weightsPath: '/elsewhere/mine.gguf',
  })

  /**
   * Rank 3 of ADR-20 as amended: the entry is admitted and MARKED. A refusal made the whole rank
   * unreachable, and every model of it read as incompatible.
   */
  it('offers it beside the shipped ones, marked as unvouched for', async () => {
    const ai = manager({
      settings: () => withOwnModel(OWN),
      runtimes: { 'sherpa-onnx': holdingRuntime() },
    })

    const candidate = candidateOf(await ai.overview(), OWN.id)

    expect(candidate?.unverified).toBe(true)
    expect(candidate?.obstacle).not.toBe('refused')
  })

  /**
   * 🛑 Their file, their disk. Removing a supplied model drops the ENTRY and never the weights —
   * the studio was pointed at them, it did not put them there.
   */
  it('is removed from the list without its file being touched', async () => {
    const remove = vi.fn(() => Promise.resolve())
    let written: PartialSettings | null = null
    const ai = manager({
      settings: () => withOwnModel(OWN),
      writeSettings: partial => (written = partial),
      runtimes: { 'sherpa-onnx': holdingRuntime({ remove }) },
    })

    await ai.remove(OWN.id)

    expect(remove).not.toHaveBeenCalled()
    expect(written).toMatchObject({ ai: { ownModels: [] } })
  })

  /**
   * 🛑 Freed before the entry goes: dropped from the catalogue, no row would offer to unload it,
   * and the runtime would hold its weights with nothing left on screen to say so.
   */
  it('gives back the memory of one that was resident before forgetting it', async () => {
    const unload = vi.fn(() => Promise.resolve())
    const ai = manager({
      settings: () => withOwnModel(OWN),
      writeSettings: () => undefined,
      runtimes: { 'sherpa-onnx': holdingRuntime({ unload }) },
    })

    await ai.load(OWN.id)
    await ai.remove(OWN.id)

    expect(unload).toHaveBeenCalledOnce()
  })

  // There is nothing to fetch: the weights are where they put them, which `weightsPath` says.
  it('is never downloaded', async () => {
    const install = vi.fn(() => Promise.resolve())
    const ai = manager({
      settings: () => withOwnModel(OWN),
      runtimes: { 'sherpa-onnx': holdingRuntime({ install }) },
    })

    await ai.install(OWN.id)

    expect(install).not.toHaveBeenCalled()
  })

  // Pointing at the same file twice is one entry: two rows naming one file would each offer to
  // remove the other's.
  it('replaces its own entry rather than appearing twice', async () => {
    let written: PartialSettings | null = null
    const ai = manager({
      settings: () => withOwnModel(OWN),
      writeSettings: partial => (written = partial),
    })

    await ai.addOwnModel({ ...OWN, name: 'Renamed' })

    expect(written).toMatchObject({ ai: { ownModels: [{ id: OWN.id, name: 'Renamed' }] } })
  })
})

describe('what a compose costs', () => {
  /**
   * `[M]` A compose reads `getGPUInfo`, a `statfs`, the memory and the video memory, and it runs
   * on every assistant turn — while what it reads moves in seconds. The reading is re-taken once
   * it has gone stale, and not before.
   */
  it('re-reads the machine only once its reading has gone stale', async () => {
    const facts = vi.fn(() => Promise.resolve(FACTS))
    let clock = 0
    const ai = manager({ facts, now: () => clock, factsTtlMs: 1_000 })

    await ai.overview()
    await ai.overview()
    expect(facts).toHaveBeenCalledOnce()

    clock = 2_000
    await ai.overview()
    expect(facts).toHaveBeenCalledTimes(2)
  })

  /**
   * 🛑 A narrowed reading covers ONE loader, and what it did not cover it cannot answer for.
   * Forgetting those bytes let the next admission over-commit what the runtime still held.
   */
  it('keeps what a narrowed reading never asked about', async () => {
    const ai = manager({ runtimes: { 'sherpa-onnx': holdingRuntime() } })

    await ai.load(STT_MODEL.id)
    // A role no `sherpa-onnx` model serves: the reading that follows names another loader entirely.
    await ai.providerOf(aiRoleId('image', 'txt2img'))

    expect(candidateOf(await ai.overview(), STT_MODEL.id)?.loaded).toBe(true)
  })

  /**
   * `[M]` `providerOf` used to compose the WHOLE overview and throw twenty rows away, on every
   * assistant turn — every runtime asked, every catalogue file stat'd. One role asks about the
   * models that role could take, and nothing else.
   */
  it('asks only about the models the role it was given could take', async () => {
    const asked: string[][] = []
    const watching = (): LocalRuntime => ({
      ...idleRuntime(),
      read: models => {
        asked.push(models.map(model => model.id))
        return Promise.resolve({ ready: true, installed: new Set<string>(), loaded: null })
      },
    })

    const ai = manager({ runtimes: { 'sherpa-onnx': watching(), llamacpp: watching() } })
    await ai.providerOf(DICTATION_ROLE)

    expect(asked).toEqual([[STT_MODEL.id]])
  })
})
