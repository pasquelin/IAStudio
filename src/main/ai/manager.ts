import type { AiOverview, ChoiceScope } from '@shared/domain/aiOverview'
import type { AiRoleId, RoleChoices, RoleProvider } from '@shared/domain/aiRole'
import type { MemorySnapshot } from '@shared/domain/aiMemory'
import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import type { PartialSettings, Settings } from '@shared/domain/settings'
import { shippedModel, shippedModels, shippedModelsFor } from './catalogue'
import type { HardwareFacts } from './hardwareProbe'
import { runtimeReadingsOf, type LocalRuntimes } from './localRuntimes'
import { aiOverviewOf } from './overview'

/**
 * What the manager needs from the rest of the studio, injected — so the whole of it is testable
 * without a disk, a network or an account.
 */
export type ManagerDeps = {
  facts: () => Promise<HardwareFacts>
  /** From the facts already read: probing twice costs two `getGPUInfo` per compose, for one answer. */
  snapshotOf: (facts: HardwareFacts) => MemorySnapshot
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
   * outside the studio would leave a turn reaching nothing. `[M]` ~2–4 ms warm against an
   * inference of several seconds — under 0.1 % of the turn it precedes.
   */
  providerOf: (role: AiRoleId) => Promise<RoleProvider | null>
  choose: (role: AiRoleId, provider: RoleProvider | null, scope: ChoiceScope) => Promise<AiOverview>
  install: (modelId: string) => Promise<AiOverview>
  cancelInstall: () => Promise<AiOverview>
  remove: (modelId: string) => Promise<AiOverview>
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

export function createAiManager(deps: ManagerDeps): AiManager {
  // At most one install runs: a second would compete for the same disk and the same bar.
  let running: RunningInstall | null = null

  /**
   * Asked of every runtime on each compose rather than remembered: a model deleted outside the
   * studio — from the folder, or by `ollama rm` — would otherwise read as present until a relaunch.
   */
  async function compose(): Promise<AiOverview> {
    const [facts, readings] = await Promise.all([
      deps.facts(),
      runtimeReadingsOf(deps.runtimes, shippedModels(), (loader, why) =>
        deps.log('info', `${loader} is not answering: ${why}`),
      ),
    ])
    const stored = deps.settings()

    return aiOverviewOf({
      facts,
      snapshot: deps.snapshotOf(facts),
      choices: stored.ai.roles,
      projectChoices: stored.ai.projectRoles,
      projectPath: deps.currentProjectPath(),
      modelsFor: shippedModelsFor,
      isInstalled: model => readings.get(model.loader)?.installed.has(model.id) === true,
      runtimeReady: model => readings.get(model.loader)?.ready === true,
      readyClouds: deps.readyClouds(),
      installing:
        running === null ? null : { modelId: running.modelId, progress: running.progress },
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
   * The bar alone. `compose` costs two hardware probes — `getGPUInfo`, a `statfs`, a memory
   * reading — plus a stat per catalogue file, and a download reports every four mebibytes.
   */
  function announceProgress(progress: DownloadProgress): void {
    if (published === null || running === null) {
      void announce()
      return
    }

    published = { ...published, installing: { modelId: running.modelId, progress } }
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
          announceProgress(progress)
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

  return {
    overview: compose,

    // Unconditional, and `published` is deliberately NOT read as "someone is listening": a window
    // that only ever asked for `overview()` never filled it, and it is exactly the window this
    // exists for. The compose it costs is a few milliseconds, once per project or account change.
    refresh: async () => {
      await announce()
    },

    providerOf: async role =>
      (await compose()).roles.find(row => row.role === role)?.provider ?? null,

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
      const model = shippedModel(modelId)
      if (model === null) return compose()

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
      const model = shippedModel(modelId)
      if (model === null) return compose()

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
  }
}
