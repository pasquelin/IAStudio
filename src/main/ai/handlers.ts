import type { AiOverview } from '@shared/domain/aiOverview'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { AiManager } from './manager'
import { parseChoice, parseModelId } from './validation'

export type AiHandlerDeps = {
  manager: AiManager
  /**
   * Rank 3's gesture, whole. It REJECTS on a file the studio cannot read, and that crosses to the
   * window: the gesture was theirs, so the refusal is theirs to see.
   */
  addOwnModel: () => Promise<AiOverview>
}

export function registerAiHandlers({ manager, addOwnModel }: AiHandlerDeps): void {
  handle(CHANNELS.aiOverview, () => manager.overview())

  handle(CHANNELS.aiChoose, (_event, role, provider, scope) => {
    // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer:
    // what arrives is `unknown` until this says otherwise.
    const choice = parseChoice(role, provider, scope)
    return manager.choose(choice.role, choice.provider, choice.scope)
  })

  handle(CHANNELS.aiInstall, (_event, modelId) => manager.install(parseModelId(modelId)))
  handle(CHANNELS.aiCancelInstall, () => manager.cancelInstall())
  handle(CHANNELS.aiRemove, (_event, modelId) => manager.remove(parseModelId(modelId)))
  handle(CHANNELS.aiLoad, (_event, modelId) => manager.load(parseModelId(modelId)))
  handle(CHANNELS.aiCancelLoad, () => manager.cancelLoad())
  handle(CHANNELS.aiUnload, (_event, modelId) => manager.unload(parseModelId(modelId)))

  handle(CHANNELS.aiAddOwnModel, () => addOwnModel())
}
