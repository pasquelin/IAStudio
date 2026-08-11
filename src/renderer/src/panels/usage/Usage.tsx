import { useTranslation } from 'react-i18next'
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

  // One empty state for two answers that look alike from here: the read has not landed, or the
  // key spent nothing. Both say there is nothing to read yet, which is the whole of it.
  if (!report) return <EmptyState icon={toolIcon('usage')} message={t('home.usage.none')} />

  return (
    <div className="flex flex-col gap-2 p-2">
      <p className="text-muted text-tiny m-0">
        {t('home.usage.summary', {
          units: formatUnits(report.units, i18n.language),
          count: report.jobs,
          days: report.period,
        })}
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {report.models.map(model => (
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
