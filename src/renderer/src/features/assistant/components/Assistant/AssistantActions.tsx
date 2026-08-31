import { useTranslation } from 'react-i18next'
import { formatUnits } from '@/helpers/format'
import { useAssistant } from '@/stores/assistant'

/**
 * What the conversation has cost, in the title row. It was read in the modal's header until
 * 28 August, and a running cost nobody can see is a running cost nobody stops.
 */
export function AssistantActions() {
  const { t, i18n } = useTranslation()
  const spent = useAssistant(state => state.spent)

  return (
    <output className="text-muted text-mini tabular-nums">
      {t('units.creative', { units: formatUnits(spent, i18n.language) })}
    </output>
  )
}
