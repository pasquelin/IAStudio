import { useTranslation } from 'react-i18next'
import { DEFAULT_USAGE_PERIOD, type ModelSpend, type UsageReport } from '@shared/domain/usage'
import { Carousel } from '@/design/Carousel'
import { useOnScreen } from '@/hooks/useOnScreen'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
// `format.ts` is the one file of the usage window the opening chunk may reach — the rest of it
// pulls the chart library in with it, which `eager-graph.test.ts` holds the line on.
import { formatUnits } from '@/usage/format'
import { Section } from '../Section'
import { SectionNote } from '../SectionNote'
import { ShelfCard, SHELF_CARD_HEIGHT } from '../ShelfCard'
import { useShelf } from '../use-shelf'

/** Wide enough for a model name and two figures under it, without wrapping either. */
const CARD_WIDTH = 220

/**
 * What the key has spent lately, and on what.
 *
 * A summary and not a second usage window: the window exists, it is opened from the menu, and it
 * has the charts. What belongs on a home is the one figure a person checks — how much went, over
 * the period the window itself opens on, so the two never disagree.
 *
 * Silent about a failure, like every other band: a revoked key among several is the ordinary
 * case, and the report already folds those into `silent` rather than refusing.
 */
export function Usage() {
  const { t, i18n } = useTranslation()
  const owner = useSettings(activeOwnerId)
  // Below the fold on any window: read when it is reached, not when the home mounts.
  const { ref, seen } = useOnScreen()

  // Read again when the active key changes: another key spends its own units.
  const report = useShelf<UsageReport | null>(
    null,
    () => (seen ? spending() : undefined),
    `${owner}/${seen}`,
  )

  // Nothing spent is not nothing to say — but nothing READ is, and the two look alike from here
  // until the report lands. The marker stays so the band can still be reached by scrolling.
  if (!report) return <div ref={ref} aria-hidden />

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
          renderCard={model => <ModelCard model={model} />}
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

function ModelCard({ model }: { model: ModelSpend }) {
  const { t, i18n } = useTranslation()

  return (
    <ShelfCard
      title={model.name}
      hint={model.name}
      subtitle={t('home.usage.model', {
        units: formatUnits(model.units, i18n.language),
        count: model.jobs,
      })}
    />
  )
}
