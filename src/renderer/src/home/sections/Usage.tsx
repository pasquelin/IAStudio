import { useTranslation } from 'react-i18next'
import { DEFAULT_USAGE_PERIOD, type ModelSpend, type UsageReport } from '@shared/domain/usage'
import { Carousel } from '@/design/Carousel'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
// `format.ts` is the one file of the usage window the opening chunk may reach — the rest of it
// pulls the chart library in with it, which `eager-graph.test.ts` holds the line on.
import { formatUnits } from '@/usage/format'
import { RefusedSection } from '../RefusedSection'
import { Section } from '../Section'
import { SectionNote } from '../SectionNote'
import { ShelfCard, SHELF_CARD_HEIGHT } from '../ShelfCard'
import { useDeferredShelf } from '@/hooks/use-shelf'

/** Wide enough for a model name and two figures under it, without wrapping either. */
const CARD_WIDTH = 220

/**
 * What the key has spent lately, and on what.
 *
 * A summary and not a second usage window: the window exists, it is opened from the menu, and it
 * has the charts. What belongs on a home is the one figure a person checks — how much went, over
 * the period the window itself opens on, so the two never disagree.
 *
 * A revoked key among several is the ordinary case, and the report folds those into an empty
 * one rather than refusing — so what reaches `refused` here is the whole read failing, which
 * the band says rather than disappearing on.
 */
export function Usage() {
  const { t, i18n } = useTranslation()
  const owner = useSettings(activeOwnerId)
  // Below the fold on any window, so it is read when reached rather than at mount. Read again
  // when the active key changes too: another key spends its own units.
  const {
    value: report,
    state,
    retry,
    marker,
  } = useDeferredShelf<UsageReport | null>(null, spending, `${owner}`)

  if (state === 'refused') return <RefusedSection id="usage" onRetry={retry} />

  // Nothing spent is not nothing to say — but nothing READ is, and the two look alike from here
  // until the report lands.
  if (!report) return marker

  const spent = formatUnits(report.units, i18n.language)

  return (
    <Section id="usage" title={t('home.sections.usage')}>
      <SectionNote>
        {t('home.usage.summary', { units: spent, count: report.jobs, days: report.period })}
      </SectionNote>

      {report.models.length > 0 && (
        <Carousel
          items={report.models.map(withId)}
          itemWidth={CARD_WIDTH}
          itemHeight={SHELF_CARD_HEIGHT}
          label={t('home.sections.usage')}
          renderCard={model => (
            <ShelfCard
              title={model.name}
              hint={model.name}
              subtitle={t('home.usage.model', {
                units: formatUnits(model.units, i18n.language),
                count: model.jobs,
              })}
            />
          )}
        />
      )}
    </Section>
  )
}

function spending(): Promise<UsageReport> | undefined {
  return getBridge()?.scenario.usageReport(DEFAULT_USAGE_PERIOD)
}

/** The carousel keys on `id`; a spend is keyed by the model it was spent on. */
function withId(model: ModelSpend): ModelSpend & { id: string } {
  return { ...model, id: model.modelId }
}
