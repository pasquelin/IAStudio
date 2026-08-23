import type {
  AiOverview,
  ChoiceScope,
  InstallRefusal,
  LoadRefusal,
} from '@shared/domain/aiOverview'
import type { AiRoleId, RoleChoices, RoleProvider } from '@shared/domain/aiRole'
import type { MemorySnapshot, RuntimeOccupancy } from '@shared/domain/aiMemory'
import type { RuntimeEndpointId } from '@shared/domain/aiRuntime'
import {
  isSuppliedModel,
  MODEL_LOADERS,
  type DownloadProgress,
  type LocalModel,
  type ModelLoader,
} from '@shared/domain/localModel'
import type { PartialSettings, Settings } from '@shared/domain/settings'
import {
  ChecksumMismatch,
  DownloadCancelled,
  NetworkInterrupted,
  isNetworkError,
} from './modelInstall'
import { admissionFor } from './admission'
import { catalogueWith, modelsForWith, modelWith, rolesServedBy } from './catalogue'
import { asRuntimeSnapshot, type HardwareFacts } from './hardwareProbe'
import {
  discoveredOf,
  endpointOf,
  endpointsOf,
  runtimeReadingsOf,
  type LocalRuntimes,
  type RuntimeReading,
} from './localRuntimes'
import { aiOverviewOf, effectiveChoices, rowFor, type OverviewInput } from './overview'

/**
 * What the manager needs from the rest of the studio, injected — so the whole of it is testable
 * without a disk, a network or an account.
 */
export type ManagerDeps = {
  facts: () => Promise<HardwareFacts>
  /** From the facts already read: probing twice costs two `getGPUInfo` per compose, for one answer. */
  snapshotOf: (
    facts: HardwareFacts,
    runtimeBytes: Readonly<Record<RuntimeEndpointId, RuntimeOccupancy>>,
  ) => MemorySnapshot
  settings: () => Settings
  writeSettings: (partial: PartialSettings) => unknown
  currentProjectPath: () => string | null
  /** The clouds an account is held for. What each SERVES is declared in `aiCloud.ts`, not here. */
  readyClouds: () => readonly string[]
  /** What can install and what can converse, by LOADER — never a branch on a model's id. */
  runtimes: LocalRuntimes
  /** Pushed on every change, so a window that did not ask still follows an install. */
  emit: (overview: AiOverview) => void
  log: (level: 'info' | 'warn' | 'error', message: string) => void
  now: () => number
  /**
   * How long a machine reading stays fresh. `[M]` A compose costs `getGPUInfo` + `statfs` + two
   * memory readings on every assistant turn. A load always reads afresh, whatever this says (R2).
   */
  factsTtlMs?: number
  /** `0` keeps them. Dictation already had this; llama and diffusion sat in VRAM all session. */
  idleUnloadMinutes?: () => number
  /** Tests inject a clock. Production uses `setTimeout`. */
  schedule?: (run: () => void, ms: number) => () => void
  /** Whether an Ollama binary is on this computer — usual locations or a studio copy. */
  ollamaInstalled: () => boolean
  /** Fetches the official archive into the studio folder when none is on this computer. */
  installOllama: (onProgress: (ratio: number) => void, signal: AbortSignal) => Promise<void>
}

export type AiManager = {
  overview: () => Promise<AiOverview>
  /**
   * Re-publishes for a change the manager cannot see — an open project, an account. Without it a
   * settings window left open keeps a stale path and a scope selector writing where nobody looks.
   */
  refresh: () => Promise<void>
  /**
   * What serves one role right now, re-composed rather than remembered: a model uninstalled
   * outside the studio would leave a turn reaching nothing.
   */
  providerOf: (role: AiRoleId) => Promise<RoleProvider | null>
  choose: (role: AiRoleId, provider: RoleProvider | null, scope: ChoiceScope) => Promise<AiOverview>
  /** One settings write for every employment a pick serves. Sequential `choose` dropped all but the last. */
  chooseMany: (
    writes: readonly { role: AiRoleId; provider: RoleProvider | null }[],
    scope: ChoiceScope,
  ) => Promise<AiOverview>
  /**
   * The ids whose weights are on this disk, read off the last runtime reading.
   *
   * Synchronous and never a probe: the model panel asks it once per summary, on every keystroke
   * of its search field. Empty until a reading has landed, which reads as "not here yet" — the
   * honest answer while nothing has said otherwise.
   */
  installedIds: () => ReadonlySet<string>
  install: (modelId: string) => Promise<AiOverview>
  cancelInstall: () => Promise<AiOverview>
  /** Puts Ollama on this computer when it is missing. One at a time, like a model install. */
  installOllama: () => Promise<AiOverview>
  cancelInstallOllama: () => Promise<AiOverview>
  remove: (modelId: string) => Promise<AiOverview>
  /**
   * Holds the weights in memory, or says why it could not — never a freeze. Cancellable, and it
   * reports: the load of a fourteen-billion-parameter model is tens of seconds of disk.
   */
  load: (modelId: string) => Promise<AiOverview>
  /**
   * A generation that skipped this drew with whatever was already resident — another model's
   * weights, or nothing.
   */
  ensureLoaded: (modelId: string) => Promise<void>
  cancelLoad: () => Promise<AiOverview>
  unload: (modelId: string) => Promise<AiOverview>
  /** Rearms idle unload and the admission LRU. */
  noteUse: (modelId: string) => void
  /** Marks the model busy until the returned function runs. */
  hold: (modelId: string) => () => void
  /** Drops the idle timer. Called when the application is going away. */
  dispose: () => void
  /** A catalogue id, including one Ollama just listed. Unknown is expected. */
  lookup: (modelId: string) => LocalModel | null
  /**
   * Drops the discovered listing so the next compose re-asks. A tag deleted outside must not
   * keep being served from cache; the stored choice is left alone.
   */
  forgetDiscovered: () => void
  /** Records a model the person supplied — rank 3 of ADR-20, and the gesture is theirs. */
  addOwnModel: (model: LocalModel) => Promise<AiOverview>
  /**
   * The install lock itself, and it RETHROWS where `install` logs: the dictation session tells a
   * broken digest from a network that gave up. Asking for a model in flight joins it.
   */
  installModel: (
    model: LocalModel,
    onProgress: (progress: DownloadProgress) => void,
    signal?: AbortSignal,
  ) => Promise<void>
}

/** Written without the role when clearing it, so the stored record does not keep a dead key. */
function withoutRole(choices: RoleChoices, role: AiRoleId): RoleChoices {
  return Object.fromEntries(Object.entries(choices).filter(([key]) => key !== role))
}

function withWrites(
  choices: RoleChoices,
  writes: readonly { role: AiRoleId; provider: RoleProvider | null }[],
): RoleChoices {
  let next = choices
  for (const write of writes) {
    next =
      write.provider === null
        ? withoutRole(next, write.role)
        : { ...next, [write.role]: write.provider }
  }
  return next
}

type RunningInstall = {
  modelId: string
  progress: DownloadProgress
  abort: AbortController
  /** Everyone who asked for this model, each reporting to its own surface. */
  watchers: ((progress: DownloadProgress) => void)[]
  /** Handed back to all of them, so two callers wait on ONE download. */
  done: Promise<void>
}

const DEFAULT_FACTS_TTL_MS = 3000
const DEFAULT_IDLE_UNLOAD_MINUTES = 10

/** How much a load must have advanced before it is worth telling every window about. */
const LOAD_STEP = 0.01

/** The loader a door belongs to, built once. A loader may answer on SEVERAL — see `endpointsOf`. */
const LOADER_BY_ENDPOINT: ReadonlyMap<RuntimeEndpointId, ModelLoader> = new Map(
  MODEL_LOADERS.flatMap(loader =>
    endpointsOf(loader).map((door): [RuntimeEndpointId, ModelLoader] => [door, loader]),
  ),
)

const loaderOf = (endpoint: RuntimeEndpointId): ModelLoader => {
  const loader = LOADER_BY_ENDPOINT.get(endpoint)
  // Unmintable from outside: every endpoint of a plan came out of the table this inverts.
  if (loader === undefined) throw new Error(`no loader answers on ${endpoint}`)

  return loader
}

function installRefusalOf(error: unknown, modelId: string): InstallRefusal {
  if (error instanceof ChecksumMismatch) return { reason: 'checksum', modelId }
  if (error instanceof NetworkInterrupted || isNetworkError(error)) {
    return { reason: 'network', modelId }
  }
  return { reason: 'failed', modelId }
}

function loadRefusalOf(error: unknown, modelId: string): LoadRefusal {
  if (error instanceof NetworkInterrupted || isNetworkError(error)) {
    return { reason: 'network', modelId }
  }
  const text = String(error)
  if (text.includes('no file named') || text.includes('incomplete-model')) {
    return { reason: 'incomplete', modelId }
  }
  return { reason: 'failed', modelId }
}

function loadThrowOf(failure: LoadRefusal): Error {
  if (failure.reason === 'beyond-machine') {
    return new Error(
      `${failure.modelId} needs ${failure.neededBytes} bytes, ${failure.availableBytes} free`,
    )
  }
  if (failure.reason === 'incomplete') return new Error('incomplete-model')
  if (failure.reason === 'network') return new Error('network')
  return new Error(`loading ${failure.modelId} failed`)
}

export function createAiManager(deps: ManagerDeps): AiManager {
  // At most one install runs: a second would compete for the same disk and the same bar.
  let running: RunningInstall | null = null
  let ollamaAbort: AbortController | null = null
  let ollamaProgress: number | null = null
  let ollamaFailed = false
  let ollamaDone: Promise<AiOverview> | null = null
  let loading: { modelId: string; ratio: number; abort: AbortController } | null = null
  let loadFailure: LoadRefusal | null = null
  let installFailure: InstallRefusal | null = null

  /**
   * What each door holds, and when it last served — the two halves `admissionFor` reads. Counting
   * an owned door's bytes as reclaimable is what makes unloading worth anything (ADR-19).
   */
  const occupancy = new Map<RuntimeEndpointId, RuntimeOccupancy & { modelId: string }>()
  const lastUsedAt = new Map<RuntimeEndpointId, number>()
  const working = new Map<RuntimeEndpointId, number>()
  let disposed = false
  const schedule =
    deps.schedule ??
    ((run, ms) => {
      const timer = setTimeout(run, ms)
      timer.unref?.()
      return () => clearTimeout(timer)
    })
  let cancelIdle: (() => void) | null = null

  const ttl = deps.factsTtlMs ?? DEFAULT_FACTS_TTL_MS
  let lastDiscovered: readonly LocalModel[] = []
  let cachedDiscovered: { at: number; models: Promise<readonly LocalModel[]> } | null = null

  function forgetDiscovered(): void {
    cachedDiscovered = null
  }

  const discover = (): Promise<readonly LocalModel[]> => {
    if (cachedDiscovered !== null && deps.now() - cachedDiscovered.at < ttl) {
      return cachedDiscovered.models
    }

    const reading = discoveredOf(deps.runtimes)
      .then(models => {
        lastDiscovered = models
        return models
      })
      .catch((error: unknown) => {
        forgetDiscovered()
        throw error
      })
    cachedDiscovered = { at: deps.now(), models: reading }
    return reading
  }

  const modelOf = (modelId: string): LocalModel | null =>
    modelWith(modelId, deps.settings().ai.ownModels, lastDiscovered)

  /**
   * Re-read once stale; the PROMISE is shared, not only its value. Two composes crossing paid
   * two `getGPUInfo` for one answer. `GpuIdentity` cannot change; `freemem` and VRAM can.
   */
  let cachedFacts: { at: number; facts: Promise<HardwareFacts> } | null = null

  const facts = (): Promise<HardwareFacts> => {
    if (cachedFacts !== null && deps.now() - cachedFacts.at < ttl) return cachedFacts.facts

    // Dropped on rejection, or one failed probe would be served for the whole of the window.
    const reading = deps.facts().catch((error: unknown) => {
      cachedFacts = null
      throw error
    })
    cachedFacts = { at: deps.now(), facts: reading }
    return reading
  }

  /** R2 of ADR-19: a plan is weighed against a reading taken NOW, never against a cached one. */
  const freshFacts = (): Promise<HardwareFacts> => {
    cachedFacts = null
    return facts()
  }

  /**
   * 🛑 NOT cached: a model deleted outside the studio would read as present until a relaunch.
   * A caller wanting one role asks only about the models that role could take.
   */
  const readingsOf = async (
    models: readonly LocalModel[],
  ): Promise<ReadonlyMap<ModelLoader, RuntimeReading>> =>
    await runtimeReadingsOf(deps.runtimes, models, (loader, why) =>
      deps.log('info', `${loader} is not answering: ${why}`),
    )

  /** What the last reading said is on the disk — see `installedIds`. */
  let onDisk: ReadonlySet<string> = new Set()

  /**
   * 🛑 The port swaps weights on its own: remembering the bytes of a model it already dropped
   * had the next admission weigh an occupation that had ended.
   */
  const reconcile = (readings: ReadonlyMap<ModelLoader, RuntimeReading>): void => {
    onDisk = new Set([...readings.values()].flatMap(reading => [...reading.installed]))

    for (const [loader, reading] of readings) {
      // Only what this reading COVERED: `providerOf` narrows to one role, so a loader absent
      // from the map was never asked. Every door of the loader: one that answers for two
      // modalities holds two, and forgetting only the first would over-commit the second.
      for (const endpoint of endpointsOf(loader)) {
        const held = occupancy.get(endpoint)
        if (held && !reading.loaded.has(held.modelId)) occupancy.delete(endpoint)
      }
    }
  }

  const inputFrom = (
    machine: HardwareFacts,
    readings: ReadonlyMap<ModelLoader, RuntimeReading>,
    stored: Settings,
    models: (role: AiRoleId) => readonly LocalModel[],
  ): OverviewInput => {
    reconcile(readings)

    return {
      facts: machine,
      snapshot: deps.snapshotOf(machine, Object.fromEntries(occupancy)),
      choices: stored.ai.roles,
      projectChoices: stored.ai.projectRoles,
      projectPath: deps.currentProjectPath(),
      modelsFor: models,
      isInstalled: model => readings.get(model.loader)?.installed.has(model.id) === true,
      isLoaded: model => readings.get(model.loader)?.loaded.has(model.id) === true,
      isHoldable: model => deps.runtimes[model.loader]?.load !== undefined,
      runtimeReady: model => readings.get(model.loader)?.ready === true,
      rolesServedBy,
      readyClouds: deps.readyClouds(),
      installing:
        running === null ? null : { modelId: running.modelId, progress: running.progress },
      loading: loading === null ? null : { modelId: loading.modelId, ratio: loading.ratio },
      loadFailure,
      installFailure,
      ollamaReady: readings.get('ollama')?.ready === true,
      ollamaInstalled: deps.ollamaInstalled(),
      ollamaNames: [],
      ollamaProgress,
      ollamaFailed,
    }
  }

  async function compose(): Promise<AiOverview> {
    // Read ONCE: `settings.read()` re-parses the whole stored tree, and this runs on every turn.
    const stored = deps.settings()
    const own = stored.ai.ownModels
    const [machine, discovered] = await Promise.all([facts(), discover()])
    const readings = await readingsOf(catalogueWith(own, discovered))
    const ollamaNames = discovered
      .filter(model => model.loader === 'ollama')
      .map(model => model.name)

    return aiOverviewOf({
      ...inputFrom(machine, readings, stored, role => modelsForWith(role, own, discovered)),
      ollamaNames,
    })
  }

  /** The last overview published, so a bar can move without asking the machine all over again. */
  let published: AiOverview | null = null

  async function announce(): Promise<AiOverview> {
    published = await compose()
    deps.emit(published)
    return published
  }

  /**
   * A bar alone. `compose` costs a `getGPUInfo`, a `statfs`, two memory readings and a stat per
   * catalogue file — far too much to pay per tick of a progress report.
   */
  function republish(patch: Partial<AiOverview>): void {
    if (published === null) {
      void announce()
      return
    }

    published = { ...published, ...patch }
    deps.emit(published)
  }

  function reportOllamaProgress(ratio: number): void {
    ollamaProgress = ratio
    if (published === null) {
      void announce()
      return
    }
    republish({ ollama: { ...published.ollama, progress: ratio } })
  }

  async function runOllamaInstall(): Promise<AiOverview> {
    ollamaAbort = new AbortController()
    ollamaProgress = 0
    ollamaFailed = false
    void announce()
    try {
      await deps.installOllama(reportOllamaProgress, ollamaAbort.signal)
      forgetDiscovered()
    } catch (error) {
      if (!(error instanceof DownloadCancelled)) {
        ollamaFailed = true
        deps.log('warn', `Ollama install stopped: ${String(error)}`)
      }
    } finally {
      ollamaAbort = null
      ollamaProgress = null
    }
    return announce()
  }

  async function fetchFiles(model: LocalModel, abort: AbortController): Promise<void> {
    try {
      const runtime = deps.runtimes[model.loader]
      // Raised rather than logged: `installModel` is the door the dictation session takes, and it
      // tells a runtime that is missing from a network that gave up on the class of what is thrown.
      if (!runtime) throw new Error(`no runtime for ${model.loader}`)

      await runtime.install(
        model,
        progress => {
          if (running === null) return

          running.progress = progress
          for (const watcher of running.watchers) watcher(progress)
          republish({ installing: { modelId: running.modelId, progress } })
        },
        abort.signal,
      )
      installFailure = null
    } catch (error) {
      if (!(error instanceof DownloadCancelled)) {
        installFailure = installRefusalOf(error, model.id)
      }
      throw error
    } finally {
      running = null
      // Caught, or it would REPLACE the download's own error: the dictation session tells a
      // broken digest from a network that gave up on the class of what is thrown.
      await announce().catch(error =>
        deps.log('warn', `manager state unpublished: ${String(error)}`),
      )
    }
  }

  function start(model: LocalModel): RunningInstall {
    installFailure = null
    const abort = new AbortController()
    // Started a tick later, so the lock below is in place before `fetchFiles` can clear it: a
    // host that threw synchronously would otherwise leave `running` set to a download nobody runs.
    const entry: RunningInstall = {
      modelId: model.id,
      progress: { received: 0, total: 0 },
      abort,
      watchers: [],
      done: Promise.resolve().then(() => fetchFiles(model, abort)),
    }

    running = entry
    void announce()

    return entry
  }

  function installModel(
    model: LocalModel,
    onProgress: (progress: DownloadProgress) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    // Aborted counts as busy: the lock is held until the host rejects, and joining an entry on
    // its way out hands back a promise already rejecting, with nothing started behind it.
    if (ollamaAbort !== null) {
      return Promise.reject(new Error('busy with ollama'))
    }

    if (running !== null && (running.modelId !== model.id || running.abort.signal.aborted)) {
      // Rejected rather than thrown: one channel for one failure, whatever the caller awaits on.
      return Promise.reject(new Error(`busy with ${running.modelId}`))
    }

    // Whoever joins is WATCHING the same download and may stop it — it is one fetch of one file
    // into one folder, and both surfaces see it stop. A join that only shared the promise left
    // the dictation status line at 0/0 with a cancel button that did nothing.
    const entry = running ?? start(model)
    entry.watchers.push(onProgress)
    signal?.addEventListener('abort', () => entry.abort.abort(), { once: true })

    return entry.done
  }

  /** Frees a DOOR and forgets what it held. A release is never added back to a reading — R2. */
  const release = async (endpoint: RuntimeEndpointId): Promise<void> => {
    if (disposed || (working.get(endpoint) ?? 0) > 0) return
    try {
      await deps.runtimes[loaderOf(endpoint)]?.unload?.(endpoint)
    } finally {
      if (!disposed && (working.get(endpoint) ?? 0) === 0) occupancy.delete(endpoint)
    }
  }

  const armIdle = (): void => {
    cancelIdle?.()
    cancelIdle = null
    if (disposed) return
    const minutes = deps.idleUnloadMinutes?.() ?? DEFAULT_IDLE_UNLOAD_MINUTES
    if (minutes <= 0 || occupancy.size === 0) return

    cancelIdle = schedule(() => {
      if (disposed || loading !== null) {
        if (!disposed) armIdle()
        return
      }
      void (async () => {
        for (const endpoint of [...occupancy.keys()]) {
          if (disposed || loading !== null) break
          if ((working.get(endpoint) ?? 0) > 0) continue
          try {
            await release(endpoint)
          } catch (error) {
            deps.log('warn', `idle unload of ${endpoint} failed: ${String(error)}`)
          }
        }
        if (!disposed && occupancy.size > 0) armIdle()
        if (!disposed) await announce()
      })()
    }, minutes * 60_000)
  }

  const markUsed = (modelId: string): void => {
    const model = modelOf(modelId)
    if (!model) return

    const endpoint = endpointOf(model.loader, model.modality)
    if (!occupancy.has(endpoint)) return

    lastUsedAt.set(endpoint, deps.now())
    armIdle()
  }

  const hold = (modelId: string): (() => void) => {
    const model = modelOf(modelId)
    if (!model || disposed) return () => {}

    const endpoint = endpointOf(model.loader, model.modality)
    markUsed(modelId)
    working.set(endpoint, (working.get(endpoint) ?? 0) + 1)
    return () => {
      const left = (working.get(endpoint) ?? 1) - 1
      if (left <= 0) working.delete(endpoint)
      else working.set(endpoint, left)
      if (!disposed && working.size === 0) armIdle()
    }
  }

  /**
   * `null` with no runtime reading is honest: R1 forbids admitting on a probe, so the load is
   * attempted and the RUNTIME refuses — still readable, never a freeze.
   */
  const admit = async (model: LocalModel): Promise<LoadRefusal | null> => {
    // Fresh, whatever the TTL says: R2 of ADR-19 asks a plan to be weighed against a reading taken
    // now, and a three-second-old one is exactly what a release just invalidated.
    const snapshot = asRuntimeSnapshot(
      deps.snapshotOf(await freshFacts(), Object.fromEntries(occupancy)),
    )
    if (snapshot === null) return null

    const active = new Set(working.keys())
    if (loading) {
      const held = modelOf(loading.modelId)
      if (held) active.add(endpointOf(held.loader, held.modality))
    }

    const admission = admissionFor(
      snapshot,
      { endpoint: endpointOf(model.loader, model.modality), needBytes: model.reservationBytes },
      { active, lastUsedAt },
    )

    if (admission.verdict === 'release-first') {
      for (const door of admission.release) {
        await release(door)
      }
    }

    if (admission.verdict !== 'refuse') return null

    // Only `beyond-machine` is about the MACHINE: the other two say the request or the reading was
    // unusable, and blaming a machine for a manifest carrying no reservation would be a lie.
    return admission.reason === 'beyond-machine'
      ? {
          reason: 'beyond-machine',
          modelId: model.id,
          neededBytes: model.reservationBytes,
          availableBytes: snapshot.availableBytes,
        }
      : { reason: 'failed', modelId: model.id }
  }

  let loadFlight: Promise<void> | null = null

  const runLoad = async (model: LocalModel): Promise<void> => {
    if (loading?.modelId === model.id && loadFlight) return loadFlight
    if (loading !== null) throw new Error(`busy loading ${loading.modelId}`)

    const work = (async () => {
      const load = deps.runtimes[model.loader]?.load
      const endpoint = endpointOf(model.loader, model.modality)

      const abort = new AbortController()
      loading = { modelId: model.id, ratio: 0, abort }
      loadFailure = null
      await announce()

      try {
        loadFailure = await admit(model)
        if (loadFailure !== null) return
        if (!load) throw new Error(`nothing here holds ${model.id} in memory`)

        const onDiskNow = await readingsOf([model])
        if (onDiskNow.get(model.loader)?.installed.has(model.id) !== true) {
          loadFailure = { reason: 'incomplete', modelId: model.id }
          deps.log(
            'warn',
            `refusing to load ${model.id}: files missing or the wrong size — reinstall`,
          )
          return
        }

        const bytes = await load(model, {
          onProgress: ratio => {
            // Gated: a runtime reports per block of tensors — hundreds of ticks a second — and each
            // one clones the whole overview to every window. A bar of a hundred steps is a bar.
            if (loading === null || ratio - loading.ratio < LOAD_STEP) return

            loading.ratio = ratio
            republish({ loading: { modelId: loading.modelId, ratio } })
          },
          signal: abort.signal,
        })

        occupancy.set(endpoint, { bytes, reclaimable: true, modelId: model.id })
        lastUsedAt.set(endpoint, deps.now())
        armIdle()
      } catch (error) {
        // No figures: only the admission weighed bytes, and a runtime that refused for its own
        // reasons — a cancellation among them — would be borrowing them from an unrelated reading.
        loadFailure = loadRefusalOf(error, model.id)
        deps.log('warn', `loading ${model.id} failed: ${String(error)}`)
      } finally {
        loading = null
      }
    })()

    loadFlight = work.finally(() => {
      if (loadFlight === work) loadFlight = null
    })
    await loadFlight
  }

  async function chooseMany(
    writes: readonly { role: AiRoleId; provider: RoleProvider | null }[],
    scope: ChoiceScope,
  ): Promise<AiOverview> {
    const stored = deps.settings()

    if (scope === 'app') {
      await deps.writeSettings({ ai: { ...stored.ai, roles: withWrites(stored.ai.roles, writes) } })
      return announce()
    }

    const path = deps.currentProjectPath()
    // Refused rather than quietly written to the default: the person asked for THIS project,
    // and silently changing everything would be the opposite of what they meant.
    if (path === null) return compose()

    await deps.writeSettings({
      ai: {
        ...stored.ai,
        projectRoles: {
          ...stored.ai.projectRoles,
          [path]: withWrites(stored.ai.projectRoles[path] ?? {}, writes),
        },
      },
    })
    return announce()
  }

  return {
    overview: compose,

    installedIds: () => onDisk,

    // Unconditional, and `published` is deliberately NOT read as "someone is listening": a window
    // that only ever asked for `overview()` never filled it, and it is exactly the window this
    // exists for. The compose it costs is a few milliseconds, once per project or account change.
    refresh: async () => {
      await announce()
    },

    lookup: modelId => modelOf(modelId),

    forgetDiscovered,

    providerOf: async role => {
      const stored = deps.settings()
      // Only what this role could take: a turn going to a cloud used to ask every loader on the
      // machine, and a turn going to llama.cpp used to stat the recognition model's four files.
      const discovered = await discover()
      const models = modelsForWith(role, stored.ai.ownModels, discovered)
      const [machine, readings] = await Promise.all([facts(), readingsOf(models)])
      const input = inputFrom(machine, readings, stored, () => models)

      return rowFor(role, input, effectiveChoices(input)).provider
    },

    choose: (role, provider, scope) => chooseMany([{ role, provider }], scope),
    chooseMany,

    installModel,

    installOllama: () => {
      if (ollamaDone) return ollamaDone
      if (running !== null) {
        deps.log('warn', 'Ollama install skipped: a model download already holds the disk')
        return compose()
      }

      ollamaDone = runOllamaInstall().finally(() => {
        ollamaDone = null
      })
      return ollamaDone
    },

    cancelInstallOllama: async () => {
      ollamaAbort?.abort()
      return published ?? compose()
    },

    install: async modelId => {
      const model = modelOf(modelId)
      // A model the person supplied has nothing to fetch: its weights are already where they put
      // them, which is what `weightsPath` says.
      if (model === null || isSuppliedModel(model)) return compose()

      try {
        // Swallowed rather than raised: a window asked, and what it needs back is the state the
        // studio is in — the reason lives in the journal.
        await installModel(model, () => {})
        forgetDiscovered()
      } catch (error) {
        deps.log('warn', `install of ${modelId} stopped: ${String(error)}`)
      }

      // What the download just announced, rather than a second reading of the same machine.
      return published ?? compose()
    },

    cancelInstall: async () => {
      running?.abort.abort()
      // What the download's own `finally` just announced, rather than a second reading of the same
      // machine — the same trade `install` makes five lines below.
      return published ?? compose()
    },

    remove: async modelId => {
      const model = modelOf(modelId)
      if (model === null) return compose()

      // 🛑 A model the person supplied is REMOVED FROM THE LIST, never from their disk: the file is
      // theirs, they put it there, and deleting it would be the studio taking away what it was
      // merely pointed at.
      if (isSuppliedModel(model)) {
        // Freed FIRST: once it is out of the catalogue no row offers to unload it any more, and
        // the runtime would go on holding its weights with nothing left to say so.
        const endpoint = endpointOf(model.loader, model.modality)
        if (occupancy.get(endpoint)?.modelId === modelId) await release(endpoint)

        const stored = deps.settings()
        await deps.writeSettings({
          ai: { ...stored.ai, ownModels: stored.ai.ownModels.filter(one => one.id !== modelId) },
        })
        return announce()
      }

      try {
        await deps.runtimes[model.loader]?.remove(model)
        forgetDiscovered()
      } catch (error) {
        // Swallowed exactly as `install` swallows its own: a window asked, and what it needs back
        // is the state the studio is in. Removing is a NETWORK call for a runtime that pulls its
        // own weights, where deleting files barely ever failed.
        deps.log('warn', `removing ${modelId} failed: ${String(error)}`)
      }
      // The choices that named it are left alone: `providerFor` falls back on its own, and
      // clearing them would lose a preference the person would want back after reinstalling.
      return announce()
    },

    load: async modelId => {
      const model = modelOf(modelId)
      if (model === null) return compose()
      if (loading !== null && loading.modelId !== modelId) return compose()

      await runLoad(model)
      return announce()
    },

    ensureLoaded: async modelId => {
      const model = modelOf(modelId)
      if (model === null) throw new Error(`${modelId} is not in the catalogue`)
      if (occupancy.get(endpointOf(model.loader, model.modality))?.modelId === modelId) return

      await runLoad(model)
      await announce()
      if (loadFailure === null) return
      throw loadThrowOf(loadFailure)
    },

    cancelLoad: async () => {
      loading?.abort.abort()
      return published ?? compose()
    },

    noteUse: markUsed,
    hold,
    dispose: () => {
      disposed = true
      cancelIdle?.()
      cancelIdle = null
    },

    unload: async modelId => {
      const model = modelOf(modelId)
      if (model === null) return compose()

      try {
        await release(endpointOf(model.loader, model.modality))
      } catch (error) {
        deps.log('warn', `unloading ${modelId} failed: ${String(error)}`)
      }
      if (occupancy.size === 0) {
        cancelIdle?.()
        cancelIdle = null
      }
      return announce()
    },

    addOwnModel: async model => {
      const stored = deps.settings()
      // Replaced rather than appended when the id is already held: pointing at the same file twice
      // is one entry, and two rows naming one file would each offer to remove the other's.
      const kept = stored.ai.ownModels.filter(one => one.id !== model.id)
      await deps.writeSettings({ ai: { ...stored.ai, ownModels: [...kept, model] } })
      return announce()
    },
  }
}
