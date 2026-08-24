import { useTranslation } from 'react-i18next'
import { SelectField, type SelectOption } from '@/design/SelectField'
import { TIP_TOP } from '@/helpers/tooltip'
import { useAssistantChoices } from '@/hooks/useAssistantChoices'
import type { AssistantChoice, AssistantGroup } from '../choices'

const GROUP_KEYS: Record<AssistantGroup, string> = {
  machine: 'assistant.groupMachine',
  clouds: 'assistant.groupClouds',
  studio: 'assistant.groupStudio',
}

/** WHO answers, picked beside the sentence — the same choice the manager screen writes. */
export function AssistantConversationPicker() {
  const { t } = useTranslation()
  const { choices, value, choose } = useAssistantChoices()

  // Three headings for a dozen rows: translated once here rather than once per option.
  const groups: Record<AssistantGroup, string> = {
    machine: t(GROUP_KEYS.machine),
    clouds: t(GROUP_KEYS.clouds),
    studio: t(GROUP_KEYS.studio),
  }

  const labelOf = (choice: AssistantChoice): string => {
    switch (choice.group) {
      case 'machine':
        return choice.name
      case 'clouds':
        // A model's own name is data and stays as it is; the cloud is named from the bundle.
        return t('assistant.cloudBrain', {
          cloud: t(`aiClouds.${choice.providerId}`),
          model: choice.name,
        })
      case 'studio':
        return t(`assistant.models.${choice.model}`)
    }
  }

  const options: SelectOption<string>[] = choices.map(choice => ({
    value: choice.value,
    group: groups[choice.group],
    label: labelOf(choice),
  }))

  return (
    <SelectField
      layout="inline"
      label={t('assistant.brain')}
      scId="assistant.brain"
      hint={TIP_TOP(t('assistant.brain'), false, t('assistant.brainHint'))}
      value={value}
      unnamedLabel={t('assistant.brainNone')}
      options={options}
      onChange={choose}
      className="max-w-56"
    />
  )
}
