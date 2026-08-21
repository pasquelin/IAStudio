import type { AiOverview, ChoiceScope } from '@shared/domain/aiOverview'
import type { AiRoleId, RoleChoices, RoleProvider } from '@shared/domain/aiRole'
import type { MemorySnapshot } from '@shared/domain/aiMemory'
import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import type { PartialSettings, Settings } from '@shared/domain/settings'
import { shippedModel, shippedModels, shippedModelsFor } from './catalogue'
import type { HardwareFacts } from './hardwareProbe'
import { aiOverviewOf } from './overview'

/**
 * What the manager needs from the rest of the studio, injected — so the whole of it is testable
 * without a disk, a network or an account.
 */
export type ManagerDeps = {
  facts: () => Promise<HardwareFacts>
  snapshot: () => Promise<MemorySnapshot>
  settings: () => Settings
  writeSettings: (partial: PartialSettings) => unknown
  currentProjectPath: () => string | null
  /** Whether an account could answer at all. A role is not offered Scenario without one. */
  scenarioReady: () => boolean
  folderFor: (model: LocalModel) => string
  isInstalled: (model: LocalModel) => Promise<boolean>
  install: (
    model: LocalModel,
    folder: string,
    onProgress: (progress: DownloadProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>
  removeFiles: (model: LocalModel, folder: string) => Promise<void>
  /** Pushed on every change, so a window that did not ask still follows an install. */
  emit: (overview: AiOverview) => void
  log: (level: 'info' | 'warn' | 'error', message: string) => void
}

export type AiManager = {
  overview: () => Promise<AiOverview>
  choose: (role: AiRoleId, provider: RoleProvider | null, scope: ChoiceScope) => Promise<AiOverview>
  install: (modelId: string) => Promise<AiOverview>
  cancelInstall: () => Promise<AiOverview>
  remove: (modelId: string) => Promise<AiOverview>
}

/** Written without the role when clearing it, so the stored record does not keep a dead key. */
function withoutRole(choices: RoleChoices, role: AiRoleId): RoleChoices {
  return Object.fromEntries(Object.entries(choices).filter(([key]) => key !== role))
}

export function createAiManager(deps: ManagerDeps): AiManager {
  // At most one install runs: a second would compete for the same disk and the same bar.
  let running: { modelId: string; progress: DownloadProgress; abort: AbortController } | null = null

  /**
   * Asked of the disk on every compose rather than remembered: a model deleted from the folder
   * outside the studio would otherwise keep reading as present until a relaunch.
   */
  async function installedIds(): Promise<ReadonlySet<string>> {
    const models = shippedModels()
    const answers = await Promise.all(models.map(model => deps.isInstalled(model)))

    return new Set(models.filter((_model, index) => answers[index]).map(model => model.id))
  }

  async function compose(): Promise<AiOverview> {
    const [facts, snapshot, installed] = await Promise.all([
      deps.facts(),
      deps.snapshot(),
      installedIds(),
    ])
    const stored = deps.settings()

    return aiOverviewOf({
      facts,
      snapshot,
      choices: stored.ai.roles,
      projectChoices: stored.ai.projectRoles,
      projectPath: deps.currentProjectPath(),
      modelsFor: shippedModelsFor,
      isInstalled: model => installed.has(model.id),
      scenarioReady: deps.scenarioReady(),
      installing:
        running === null ? null : { modelId: running.modelId, progress: running.progress },
    })
  }

  async function announce(): Promise<AiOverview> {
    const next = await compose()
    deps.emit(next)
    return next
  }

  return {
    overview: compose,

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

    install: async modelId => {
      const model = shippedModel(modelId)
      if (model === null || running !== null) return compose()

      const abort = new AbortController()
      running = { modelId, progress: { received: 0, total: 0 }, abort }
      void announce()

      try {
        await deps.install(
          model,
          deps.folderFor(model),
          progress => {
            if (running !== null) running.progress = progress
            void announce()
          },
          abort.signal,
        )
      } catch (error) {
        deps.log('warn', `install of ${modelId} stopped: ${String(error)}`)
      } finally {
        running = null
      }

      return announce()
    },

    cancelInstall: async () => {
      running?.abort.abort()
      return compose()
    },

    remove: async modelId => {
      const model = shippedModel(modelId)
      if (model === null) return compose()

      await deps.removeFiles(model, deps.folderFor(model))
      // The choices that named it are left alone: `providerFor` falls back on its own, and
      // clearing them would lose a preference the person would want back after reinstalling.
      return announce()
    },
  }
}
