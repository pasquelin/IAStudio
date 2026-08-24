import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import { machineSummary } from '@/helpers/machineSummary'
import { useBytes } from '@/hooks/useBytes'
import { useAiModels } from '@/stores/aiModels'
import { useSettings } from '@/stores/settings'
import { Section } from '../../Section'
import { ModelInventoryEmployments } from './ModelInventoryEmployments'
import { ModelInventorySources } from './ModelInventorySources'

/**
 * What this studio can run, and with what — where the feed of everything published on Scenario
 * stood until now.
 *
 * 🛑 It INFORMS and leads; it does not manage. Installing, removing and loading live in the
 * settings since ADR-23, and a second set of those gestures here would be a second place a
 * download can start from, with nothing saying which of the two is running.
 */
export function ModelInventory() {
  const { t } = useTranslation()
  const bytes = useBytes()
  const overview = useAiModels(state => state.overview)
  const openSection = useSettings(state => state.openSection)

  return (
    <Section id="models" title={t('home.sections.models')}>
      {overview === null ? (
        <QuietNote standalone>{t('aiModels.reading')}</QuietNote>
      ) : (
        <div className="flex flex-col gap-4">
          <QuietNote>{machineSummary(overview.machine, t, bytes)}</QuietNote>
          <ModelInventorySources overview={overview} onOpen={openSection} />
          <ModelInventoryEmployments overview={overview} onOpen={openSection} />
        </div>
      )}
    </Section>
  )
}
