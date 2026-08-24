import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import { useAiModels } from '@/stores/aiModels'
import { useSettings } from '@/stores/settings'
import { Section } from '../../Section'
import { ModelInventoryAdvice } from './ModelInventoryAdvice'
import { ModelInventoryCoverage } from './ModelInventoryCoverage'
import { ModelInventoryEmployments } from './ModelInventoryEmployments'
import { ModelInventoryMeans } from './ModelInventoryMeans'

/**
 * What this studio can run, and with what.
 *
 * 🛑 It INFORMS and leads; it does not manage. Installing, removing and loading live in the
 * settings since ADR-23, and a second set of those gestures here would be a second place a
 * download can start from, with nothing saying which of the two is running.
 */
export function ModelInventory() {
  const { t } = useTranslation()
  const overview = useAiModels(state => state.overview)
  const openSection = useSettings(state => state.openSection)

  return (
    <Section id="models" title={t('home.sections.models')}>
      {overview === null ? (
        <QuietNote standalone>{t('aiModels.reading')}</QuietNote>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Two columns where the centre has the width for them, one where it does not — a
              container query rather than a breakpoint, the panel columns beside this band
              narrowing it without the viewport moving. */}
          <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
            <ModelInventoryMeans overview={overview} onOpen={openSection} />
            <ModelInventoryEmployments overview={overview} onOpen={openSection} />
          </div>

          <ModelInventoryCoverage overview={overview} onOpen={openSection} />
          <ModelInventoryAdvice overview={overview} onOpen={openSection} />
        </div>
      )}
    </Section>
  )
}
