import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_USAGE_PERIOD,
  USAGE_PERIODS,
  type UsagePeriod,
  type UsageReport,
} from '@shared/domain/usage'
import { DRAGGABLE } from '@/helpers/app-region'
import { cn } from '@/helpers/cn'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { UsageActivities } from './UsageActivities'
import { UsageJournal } from './UsageJournal'
import { UsageModels } from './UsageModels'
import { UsageOverview } from './UsageOverview'
import { useUsageReport } from './useUsageReport'

export type UsageSectionId = 'overview' | 'models' | 'activities' | 'journal'

const SECTIONS: readonly UsageSectionId[] = ['overview', 'models', 'activities', 'journal']

/**
 * What every stored key has spent, in its own window off the Help menu.
 *
 * Outside the docks, so DaisyUI rather than the design system — this is the application being an
 * application, and it borrows the preferences' shape for the same reason: four screens, read one
 * at a time, where the log must not load until it is asked for.
 *
 * Consumption only. The API publishes no balance, no quota and no subscription state, so nothing
 * here can answer "how much is left" — which is why the window says so rather than implying it.
 */
export function UsageWindow() {
  const { t } = useTranslation()
  useAppliedSettings()

  const [period, setPeriod] = useState<UsagePeriod>(DEFAULT_USAGE_PERIOD)
  const [section, setSection] = useState<UsageSectionId>('overview')
  const { report, loading, failure, reload } = useUsageReport(period)

  return (
    <div className="bg-base-200 text-base-content flex h-screen flex-col">
      <header
        style={DRAGGABLE}
        className="flex shrink-0 items-center gap-3 pt-2 pr-4 pb-2 pl-24 text-[13px] font-medium"
      >
        {t('usage.title')}

        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label={t('usage.period.label')}
            className="select select-xs w-28"
            value={period}
            onChange={event => setPeriod(periodOf(event.target.value))}
          >
            {USAGE_PERIODS.map(days => (
              <option key={days} value={days}>
                {t('usage.period.days', { count: days })}
              </option>
            ))}
          </select>

          <button type="button" className="btn btn-xs" onClick={reload} disabled={loading}>
            {t('usage.refresh')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('usage.title')}
          className="border-base-300 flex w-44 shrink-0 flex-col gap-0.5 overflow-auto border-r p-2"
        >
          {SECTIONS.map(id => (
            <button
              key={id}
              type="button"
              aria-current={id === section ? 'page' : undefined}
              onClick={() => setSection(id)}
              className={cn(
                'cursor-pointer rounded px-2 py-1 text-left text-xs',
                id === section ? 'bg-base-300 font-medium' : 'hover:bg-base-300/60',
              )}
            >
              {t(`usage.sections.${id}`)}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1 overflow-auto px-6 py-4">
          {failure ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm">{t('usage.failure')}</p>
              <button type="button" className="btn btn-xs" onClick={reload}>
                {t('usage.retry')}
              </button>
            </div>
          ) : loading && !report ? (
            <p className="text-base-content/60 text-xs">{t('usage.loading')}</p>
          ) : report ? (
            <Section id={section} period={period} report={report} />
          ) : null}
        </main>
      </div>
    </div>
  )
}

/** The select hands back a string; anything unexpected falls back to the default period. */
function periodOf(value: string): UsagePeriod {
  return USAGE_PERIODS.find(days => String(days) === value) ?? DEFAULT_USAGE_PERIOD
}

type SectionProps = {
  id: UsageSectionId
  period: UsagePeriod
  report: UsageReport
}

function Section({ id, period, report }: SectionProps) {
  if (id === 'models') return <UsageModels report={report} />
  if (id === 'activities') return <UsageActivities report={report} />
  if (id === 'journal') return <UsageJournal period={period} />
  return <UsageOverview report={report} />
}
