import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import { DEFAULT_USAGE_PERIOD, type ModelSpend, type UsageReport } from '@shared/domain/usage'
import { EmptyState } from '@/design/EmptyState'
import { HINT_LEFT } from '@/helpers/tooltip'
import { toolIcon } from '@/helpers/tool-registry'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
// `format.ts` is the one file of the usage window the opening chunk may reach — the rest of it
// pulls the chart library in with it, which `eager-graph.test.ts` holds the line on.
import { formatUnits } from '@/usage/format'
import { RefusedPanel } from '@/panels/shared/RefusedPanel'
import { useShelf } from '@/hooks/use-shelf'

/** How many models the summary names. Enough to see where the units went, few enough to glance. */
const MOST_SPENT = 12

/**
 * What the key has spent lately, and on what.
 *
 * A summary and not a second usage window: the window exists, it is opened from the menu, and it
 * has the charts. What belongs here is the one figure a person checks — how much went, over
 * the period the window itself opens on, so the two never disagree.
 *
 * A revoked key among several is the ordinary case, and the report folds those into an empty
 * one rather than refusing — so what reaches `refused` here is the whole read failing, which
 * the panel says rather than disappearing on.
 *
 * A column rather than the carousel it was as a band, and read at mount rather than when
 * scrolled to: a panel is only mounted once its half shows it, so there is nothing left to defer.
 */
export function Usage() {
  const { t, i18n } = useTranslation()
  const owner = useSettings(activeOwnerId)
  // Read again when the active key changes: another key spends its own units.
  const { value: report, state, retry } = useShelf<UsageReport | null>(null, spending, `${owner}`)

  if (state === 'refused') return <RefusedPanel tool="usage" onRetry={retry} />

  // A read still in flight is not an account that spent nothing, and this panel waits on the
  // slowest aggregate of the six: saying "nothing spent" meanwhile is a claim it has not verified,
  // and one it contradicts a second later.
  if (!report) {
    const message = state === 'reading' ? t('home.reading') : t('home.usage.none')
    return <EmptyState icon={toolIcon('usage')} message={message} />
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <QuietNote>
        {t('home.usage.summary', {
          units: formatUnits(report.units, i18n.language),
          count: report.jobs,
          days: report.period,
        })}
      </QuietNote>

      {/* Bounded, and painted rather than virtualized: an account can spend on a hundred models
          over a month, and a hundred rows in a narrow column is work the UI thread does for
          nothing — what is read here is the top of the list. */}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {report.models.slice(0, MOST_SPENT).map(model => (
          <Spend key={model.modelId} model={model} />
        ))}
      </ul>
    </div>
  )
}

function Spend({ model }: { model: ModelSpend }) {
  const { t, i18n } = useTranslation()

  return (
    <li className="bg-surface flex flex-col gap-0.5 rounded-(--radius-sc-md) p-2">
      {/* The name is truncated by the column's width, and the hint is where the whole of it is
          read. Placed left, as everything in this column is. */}
      <span {...HINT_LEFT(model.name)} className="text-text truncate text-xs">
        {model.name}
      </span>
      <span className="text-muted text-tiny">
        {t('home.usage.model', {
          units: formatUnits(model.units, i18n.language),
          count: model.jobs,
        })}
      </span>
    </li>
  )
}

function spending(): Promise<UsageReport> | undefined {
  return getBridge()?.scenario.usageReport(DEFAULT_USAGE_PERIOD)
}
