import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { ModelRegistry } from './model-registry'
import { parseModelFamily, parseModelId } from './validation'

export type ScenarioHandlerDeps = {
  models: ModelRegistry
}

export function registerScenarioHandlers({ models }: ScenarioHandlerDeps): void {
  handle(CHANNELS.scenarioListModels, (_event, family) => models.list(parseModelFamily(family)))

  handle(CHANNELS.scenarioDescribeModel, (_event, modelId) =>
    models.describe(parseModelId(modelId)),
  )
}
