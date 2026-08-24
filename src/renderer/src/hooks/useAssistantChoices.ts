import { writeScopeFor } from '@shared/domain/aiOverview'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import {
  assistantChoicesOf,
  providerOfChoice,
  servingChoiceValue,
  type AssistantChoice,
} from '@/assistant/choices'
import { useAiModels } from '@/stores/aiModels'
import { useAssistant } from '@/stores/assistant'
import { useSettings } from '@/stores/settings'

export type AssistantChoices = {
  choices: readonly AssistantChoice[]
  /** The entry answering today, `null` while nothing serves the assistant at all. */
  value: string | null
  choose: (value: string) => void
}

/** What may answer, and the one gesture that changes it — the manager screen's own write. */
export function useAssistantChoices(): AssistantChoices {
  const overview = useAiModels(state => state.overview)
  const chooseAiProvider = useAiModels(state => state.chooseAiProvider)
  const studioModel = useSettings(state => state.settings.assistant.model)
  const cloudModels = useSettings(state => state.settings.assistant.cloudModels)

  const row = overview?.roles.find(one => one.role === ASSISTANT_ROLE)
  const choices = assistantChoicesOf(row, cloudModels)

  return {
    choices,
    value: servingChoiceValue(row?.provider ?? null, studioModel),
    choose: value => {
      const picked = choices.find(one => one.value === value)
      if (picked === undefined || row === undefined) return

      // Written before the provider: the brain reads the model on the turn it answers, so the
      // pair is settled by the time anything can ask.
      if (picked.group === 'studio') useAssistant.getState().setModel(picked.model)
      void chooseAiProvider(
        ASSISTANT_ROLE,
        providerOfChoice(picked),
        writeScopeFor(row, overview?.projectPath ?? null),
      )
    },
  }
}
