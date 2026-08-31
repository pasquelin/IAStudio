import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/components/QuietNote'
import { useAiModels } from '@/stores/aiModels'
import { useSettings } from '@/stores/settings'
import { Section } from '../Section'
import { ModelInventoryCoverage } from './ModelInventoryCoverage'
import { ModelInventoryEmployments } from './ModelInventoryEmployments'
import { ModelInventoryMeans } from './ModelInventoryMeans'
import { ModelInventoryVerdict } from './ModelInventoryVerdict'

/**
 * What this studio can run, and with what — read top down: where it stands, what it has, and
 * what one download would add.
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
        <div className="@container flex flex-col gap-4">
          <ModelInventoryVerdict overview={overview} onOpen={openSection} />

          {/* A CONTAINER query, not a breakpoint: breakpoints answer to the viewport, and the
              panel columns beside this band narrow it without moving one. The first draft asked
              for `auto-fit`, which Tailwind never emitted — the two blocks stacked on every
              window, and nothing said so. */}
          <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
            <ModelInventoryMeans overview={overview} onOpen={openSection} />
            <ModelInventoryEmployments overview={overview} onOpen={openSection} />
          </div>

          <ModelInventoryCoverage overview={overview} onOpen={openSection} />
        </div>
      )}
    </Section>
  )
}
