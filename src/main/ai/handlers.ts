import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { AiManager } from './manager'
import { parseChoice } from './validation'

export function registerAiHandlers(manager: AiManager): void {
  handle(CHANNELS.aiOverview, () => manager.overview())

  handle(CHANNELS.aiChoose, (_event, role, provider, scope) => {
    // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer:
    // what arrives is `unknown` until this says otherwise.
    const choice = parseChoice(role, provider, scope)
    return manager.choose(choice.role, choice.provider, choice.scope)
  })

  handle(CHANNELS.aiInstall, (_event, modelId) => manager.install(String(modelId)))
  handle(CHANNELS.aiCancelInstall, () => manager.cancelInstall())
  handle(CHANNELS.aiRemove, (_event, modelId) => manager.remove(String(modelId)))
}
