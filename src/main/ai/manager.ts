import type { AiOverview, ChoiceScope, LoadRefusal } from '@shared/domain/aiOverview'
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
import { admissionFor } from './admission'
import { catalogueWith, modelsForWith, modelWith } from './catalogue'
import { asRuntimeSnapshot, type HardwareFacts } from './hardwareProbe'
import {
  ENDPOINT_BY_LOADER,
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
   * How long a machine reading stays fresh. `[M]` A compose costs a `getGPUInfo`, a `statfs`, a
   * memory reading and a VRAM reading, and it runs on every assistant turn — while what it reads
   * moves in seconds, not in milliseconds. A load always reads afresh, whatever this says (R2).
   */
  factsTtlMs?: number
}

export type AiManager = {
  overview: () => Promise<AiOverview>
  /**
   * Re-publishes for a change the manager cannot see — an open project, an account. Without it a
   * settings window left open keeps a stale path, stale badges and a scope selector writing where
   * nobody is looking.
   */
  refresh: () => Promise<void>
  /**
   * What serves one role right now, re-composed rather than remembered: a model uninstalled
   * outside the studio would leave a turn reaching nothing. ONE row, and only the runtimes that
   * role could reach are asked.
   */
  providerOf: (role: AiRoleId) => Promise<RoleProvider | null>
  choose: (role: AiRoleId, provider: RoleProvider | null, scope: ChoiceScope) => Promise<AiOverview>
  install: (modelId: string) => Promise<AiOverview>
  cancelInstall: () => Promise<AiOverview>
  remove: (modelId: string) => Promise<AiOverview>
  /**
   * Holds the weights in memory, or says why it could not — never a freeze. Cancellable, and it
   * reports: the load of a fourteen-billion-parameter model is tens of seconds of disk.
   */
  load: (modelId: string) => Promise<AiOverview>
  cancelLoad: () => Promise<AiOverview>
  unload: (modelId: string) => Promise<AiOverview>
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

/** How much a load must have advanced before it is worth telling every window about. */
const LOAD_STEP = 0.01

/** The loader a door belongs to — the inverse of `ENDPOINT_BY_LOADER`, built once. */
const LOADER_BY_ENDPOINT: ReadonlyMap<RuntimeEndpointId, ModelLoader> = new Map(
  MODEL_LOADERS.map(loader => [ENDPOINT_BY_LOADER[loader], loader]),
)

const loaderOf = (endpoint: RuntimeEndpointId): ModelLoader => {
  const loader = LOADER_BY_ENDPOINT.get(endpoint)
  // Unmintable from outside: every endpoint of a plan came out of the table this inverts.
  if (loader === undefined) throw new Error(`no loader answers on ${endpoint}`)

  return loader
}

export function createAiManager(deps: ManagerDeps): AiManager {
  // At most one install runs: a second would compete for the same disk and the same bar.
  let running: RunningInstall | null = null
  let loading: { modelId: string; ratio: number; abort: AbortController } | null = null
  let loadFailure: LoadRefusal | null = null

  /**
   * What each door holds, and when it last served — the two halves `admissionFor` reads. Counting
   * an owned door's bytes as reclaimable is what makes unloading worth anything (ADR-19).
   */
  const occupancy = new Map<RuntimeEndpointId, RuntimeOccupancy & { modelId: string }>()
  const lastUsedAt = new Map<RuntimeEndpointId, number>()

  const modelOf = (modelId: string): LocalModel | null =>
    modelWith(modelId, deps.settings().ai.ownModels)

  /**
   * The machine, re-read only once it has gone stale. `GpuIdentity` cannot change under a running
   * process; `freemem`, `statfs` and the VRAM can, and are what the window is short.
   *
   * The PROMISE is shared, not only its value: every window asks on connecting, so two composes
   * crossing before the first resolved paid two `getGPUInfo` for one answer.
   */
  let cachedFacts: { at: number; facts: Promise<HardwareFacts> } | null = null
  const ttl = deps.factsTtlMs ?? DEFAULT_FACTS_TTL_MS

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
   * What each loader answers for, asked afresh rather than remembered.
   *
   * 🛑 NOT cached, and the reason has not gone away: a model deleted outside the studio — from the
   * folder, or by `ollama rm` — would read as present until a relaunch. What IS narrowed is the
   * question: a caller wanting one role asks only about the models that role could take.
   */
  const readingsOf = async (
    models: readonly LocalModel[],
  ): Promise<ReadonlyMap<ModelLoader, RuntimeReading>> =>
    await runtimeReadingsOf(deps.runtimes, models, (loader, why) =>
      deps.log('info', `${loader} is not answering: ${why}`),
    )

  /**
   * Drops what a door no longer holds.
   *
   * 🛑 The port decides on its own: a turn on another model makes it swap the weights, so what was
   * "activated" is gone and nothing said so. Remembering the bytes anyway had the next admission
   * weigh an occupation that had ended.
   */
  const reconcile = (readings: ReadonlyMap<ModelLoader, RuntimeReading>): void => {
    for (const [loader, reading] of readings) {
      // Only what this reading COVERED: `providerOf` narrows the models to one role, so a loader
      // absent from the map was never asked — and forgetting its bytes would let the next
      // admission over-commit what is still resident.
      const endpoint = ENDPOINT_BY_LOADER[loader]
      const held = occupancy.get(endpoint)
      if (held && reading.loaded !== held.modelId) occupancy.delete(endpoint)
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
      isLoaded: model => readings.get(model.loader)?.loaded === model.id,
      isHoldable: model => deps.runtimes[model.loader]?.load !== undefined,
      runtimeReady: model => readings.get(model.loader)?.ready === true,
      readyClouds: deps.readyClouds(),
      installing:
        running === null ? null : { modelId: running.modelId, progress: running.progress },
      loading: loading === null ? null : { modelId: loading.modelId, ratio: loading.ratio },
      loadFailure,
    }
  }

  async function compose(): Promise<AiOverview> {
    // Read ONCE: `settings.read()` re-parses the whole stored tree, and this runs on every turn.
    const stored = deps.settings()
    const own = stored.ai.ownModels
    const [machine, readings] = await Promise.all([facts(), readingsOf(catalogueWith(own))])

    return aiOverviewOf(inputFrom(machine, readings, stored, role => modelsForWith(role, own)))
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

  /** Frees a door and forgets what it held. A release is never added back to a reading — R2. */
  const release = async (loader: ModelLoader): Promise<void> => {
    await deps.runtimes[loader]?.unload?.()
    occupancy.delete(ENDPOINT_BY_LOADER[loader])
  }

  /**
   * What stands between this model and the memory, or `null` when nothing does.
   *
   * `null` with no runtime reading is the honest answer: R1 forbids admitting on a probe, so the
   * load is attempted and the RUNTIME does the refusing — still readable, and never a freeze.
   */
  const admit = async (model: LocalModel): Promise<LoadRefusal | null> => {
    // Fresh, whatever the TTL says: R2 of ADR-19 asks a plan to be weighed against a reading taken
    // now, and a three-second-old one is exactly what a release just invalidated.
    const snapshot = asRuntimeSnapshot(
      deps.snapshotOf(await freshFacts(), Object.fromEntries(occupancy)),
    )
    if (snapshot === null) return null

    const admission = admissionFor(
      snapshot,
      { endpoint: ENDPOINT_BY_LOADER[model.loader], needBytes: model.reservationBytes },
      // Nothing is `active`: a door is either loading — and this is the load — or idle, since one
      // load runs at a time and a turn holds its door for the length of one answer.
      { active: new Set(), lastUsedAt },
    )

    if (admission.verdict === 'release-first') {
      for (const door of admission.release) {
        await release(loaderOf(door))
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

  const runLoad = async (model: LocalModel): Promise<void> => {
    const load = deps.runtimes[model.loader]?.load
    const endpoint = ENDPOINT_BY_LOADER[model.loader]

    const abort = new AbortController()
    loading = { modelId: model.id, ratio: 0, abort }
    loadFailure = null
    await announce()

    try {
      loadFailure = await admit(model)
      if (loadFailure !== null) return
      if (!load) throw new Error(`nothing here holds ${model.id} in memory`)

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
    } catch (error) {
      // No figures: only the admission weighed bytes, and a runtime that refused for its own
      // reasons — a cancellation among them — would be borrowing them from an unrelated reading.
      loadFailure = { reason: 'failed', modelId: model.id }
      deps.log('warn', `loading ${model.id} failed: ${String(error)}`)
    } finally {
      loading = null
    }
  }

  return {
    overview: compose,

    // Unconditional, and `published` is deliberately NOT read as "someone is listening": a window
    // that only ever asked for `overview()` never filled it, and it is exactly the window this
    // exists for. The compose it costs is a few milliseconds, once per project or account change.
    refresh: async () => {
      await announce()
    },

    providerOf: async role => {
      const stored = deps.settings()
      // Only what this role could take: a turn going to a cloud used to ask every loader on the
      // machine, and a turn going to llama.cpp used to stat the recognition model's four files.
      const models = modelsForWith(role, stored.ai.ownModels)
      const [machine, readings] = await Promise.all([facts(), readingsOf(models)])
      const input = inputFrom(machine, readings, stored, () => models)

      return rowFor(role, input, effectiveChoices(input)).provider
    },

    choose: async (role, provider, scope) => {
      const stored = deps.settings()

      if (scope === 'app') {
        const roles =
          provider === null
            ? withoutRole(stored.ai.roles, role)
            : { ...stored.ai.roles, [role]: provider }
        await deps.writeSettings({ ai: { ...stored.ai, roles } })
        return announce()
      }

      const path = deps.currentProjectPath()
      // Refused rather than quietly written to the default: the person asked for THIS project,
      // and silently changing everything would be the opposite of what they meant.
      if (path === null) return compose()

      const forProject = stored.ai.projectRoles[path] ?? {}
      const updated =
        provider === null ? withoutRole(forProject, role) : { ...forProject, [role]: provider }

      await deps.writeSettings({
        ai: { ...stored.ai, projectRoles: { ...stored.ai.projectRoles, [path]: updated } },
      })
      return announce()
    },

    installModel,

    install: async modelId => {
      const model = modelOf(modelId)
      // A model the person supplied has nothing to fetch: its weights are already where they put
      // them, which is what `weightsPath` says.
      if (model === null || isSuppliedModel(model)) return compose()

      try {
        // Swallowed rather than raised: a window asked, and what it needs back is the state the
        // studio is in — the reason lives in the journal.
        await installModel(model, () => {})
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
        if (occupancy.get(ENDPOINT_BY_LOADER[model.loader])?.modelId === modelId) {
          await release(model.loader)
        }

        const stored = deps.settings()
        await deps.writeSettings({
          ai: { ...stored.ai, ownModels: stored.ai.ownModels.filter(one => one.id !== modelId) },
        })
        return announce()
      }

      try {
        await deps.runtimes[model.loader]?.remove(model)
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
      if (model === null || loading !== null) return compose()

      await runLoad(model)
      return announce()
    },

    cancelLoad: async () => {
      loading?.abort.abort()
      return published ?? compose()
    },

    unload: async modelId => {
      const model = modelOf(modelId)
      if (model === null) return compose()

      try {
        await release(model.loader)
      } catch (error) {
        deps.log('warn', `unloading ${modelId} failed: ${String(error)}`)
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
