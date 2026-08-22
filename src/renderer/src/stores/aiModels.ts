import { create } from 'zustand'
import type { AiOverview, ChoiceScope } from '@shared/domain/aiOverview'
import type { AiRoleId, RoleProvider } from '@shared/domain/aiRole'
import type { StudioBridge } from '@shared/ipc'
import { connectThroughBridge, getBridge } from '@/services/bridge'

type AiModelsState = {
  /**
   * What the manager screen reads, `null` until something answers. Never recomputed here: the
   * main process holds the memory reading, and two sides deciding would disagree.
   */
  overview: AiOverview | null

  /** Follows the manager and reads its state. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  /**
   * Writes the provider for a role, or clears it with `null` — which is not "none".
   *
   * 🛑 Written ON THE SPOT, where every other screen of this window stages into `settingsDraft`
   * and waits for Apply: the manager owns the write, since it re-judges every candidate and
   * re-broadcasts the overview, and a staged choice could not be re-judged. Cancel therefore does
   * not take a role choice back — settled 21/08, and written into `SettingsWindow`'s own contract.
   */
  chooseAiProvider: (
    role: AiRoleId,
    provider: RoleProvider | null,
    scope: ChoiceScope,
  ) => Promise<void>
  chooseAiProviders: (
    writes: readonly { role: AiRoleId; provider: RoleProvider | null }[],
    scope: ChoiceScope,
  ) => Promise<void>
  /** Fetches a model's files. Resolves once the download ends, progress arriving meanwhile. */
  installAiModel: (modelId: string) => Promise<void>
  cancelAiInstall: () => Promise<void>
  removeAiModel: (modelId: string) => Promise<void>
  /** Holds the weights in memory, or leaves `overview.loadFailure` saying why it could not. */
  loadAiModel: (modelId: string) => Promise<void>
  cancelAiLoad: () => Promise<void>
  unloadAiModel: (modelId: string) => Promise<void>
  /**
   * Asks for a weights file and records what its header says.
   *
   * The only command of this store that can FAIL in a way the overview cannot carry: the gesture
   * belongs to one window, so its refusal is kept here rather than broadcast to every other.
   */
  addOwnAiModel: () => Promise<void>
  /** Why the last supplied file was refused, or nothing. Cleared by the next attempt. */
  ownModelFailure: 'unreadable' | null
}

/**
 * The AI manager, as this window sees it. The main process pushes the whole overview on any
 * change, so an install begun from the status line moves the bar of a manager nobody touched.
 */
export const useAiModels = create<AiModelsState>()(set => {
  /** Every command answers with the whole overview, so none of them has a reply of its own. */
  const command = async (ask: (bridge: StudioBridge) => Promise<AiOverview>) => {
    const bridge = getBridge()
    if (bridge) set({ overview: await ask(bridge) })
  }

  return {
    overview: null,
    ownModelFailure: null,

    connect: connectThroughBridge(async bridge => {
      let pushed = false
      const stop = bridge.ai.onChanged(overview => {
        pushed = true
        set({ overview })
      })

      try {
        const answered = await bridge.ai.overview()
        // A snapshot in flight must not overwrite a change that landed after it was asked for —
        // an install running while this window opens publishes its progress on the event channel.
        if (!pushed) set({ overview: answered })
      } catch {
        // The subscription holds; the screen simply stays on what it had.
      }

      return stop
    }),

    chooseAiProvider: (role, provider, scope) =>
      command(bridge => bridge.ai.choose(role, provider, scope)),
    chooseAiProviders: (writes, scope) => command(bridge => bridge.ai.chooseMany(writes, scope)),
    installAiModel: modelId => command(bridge => bridge.ai.install(modelId)),
    cancelAiInstall: () => command(bridge => bridge.ai.cancelInstall()),
    removeAiModel: modelId => command(bridge => bridge.ai.remove(modelId)),
    loadAiModel: modelId => command(bridge => bridge.ai.load(modelId)),
    cancelAiLoad: () => command(bridge => bridge.ai.cancelLoad()),
    unloadAiModel: modelId => command(bridge => bridge.ai.unload(modelId)),

    addOwnAiModel: async () => {
      set({ ownModelFailure: null })
      try {
        await command(bridge => bridge.ai.addOwnModel())
      } catch {
        // One reason, and it is the only one a person can act on: the file they pointed at is not
        // a weights file this studio can read. The journal holds what actually happened.
        set({ ownModelFailure: 'unreadable' })
      }
    },
  }
})
