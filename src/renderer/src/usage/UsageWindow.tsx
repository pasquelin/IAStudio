import { mdiRefresh } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_USAGE_PERIOD,
  USAGE_PERIODS,
  type UsagePeriod,
  type UsageReport,
} from '@shared/domain/usage'
import { UiIcon } from '@/design/UiIcon'
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
 * Built on the settings window's shape rather than its own: sections on the left, the selected
 * one on the right, the control that scopes everything at the top of the nav — where the
 * settings search sits, and for the same reason.
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
    <div className="bg-base-200 text-base-content flex h-full flex-col">
      <header
        style={DRAGGABLE}
        className="flex shrink-0 items-center pt-2 pr-4 pb-2 pl-24 text-[13px] font-medium"
      >
        {t('usage.title')}
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('usage.title')}
          className="border-base-300 flex w-56 shrink-0 flex-col gap-2 overflow-auto border-r p-2"
        >
          <div role="group" aria-label={t('usage.period.label')} className="flex gap-0.5">
            {USAGE_PERIODS.map(days => (
              <button
                key={days}
                type="button"
                aria-pressed={days === period}
                onClick={() => setPeriod(days)}
                className={cn(
                  'flex h-(--sc-control) flex-1 cursor-pointer items-center justify-center',
                  'rounded-(--radius-sc-sm) border-none text-xs',
                  days === period
                    ? 'bg-primary text-primary-content'
                    : 'hover:bg-base-300 bg-transparent',
                )}
              >
                {t('usage.period.short', { count: days })}
              </button>
            ))}
          </div>

          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {SECTIONS.map(id => (
              <li key={id}>
                <button
                  type="button"
                  aria-current={id === section ? 'page' : undefined}
                  onClick={() => setSection(id)}
                  className={cn(
                    'flex h-(--sc-control) w-full cursor-pointer items-center rounded-(--radius-sc-sm)',
                    'border-none bg-transparent pr-3 pl-3 text-left text-xs',
                    id === section ? 'bg-primary text-primary-content' : 'hover:bg-base-300',
                  )}
                >
                  {t(`usage.sections.${id}`)}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className={cn(
              'mt-auto flex h-(--sc-control) w-full cursor-pointer items-center gap-1.5',
              'rounded-(--radius-sc-sm) border-none bg-transparent px-3 text-left text-xs',
              'hover:bg-base-300 disabled:cursor-default disabled:opacity-50',
            )}
          >
            <UiIcon path={mdiRefresh} size={14} />
            {t('usage.refresh')}
          </button>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto px-6 py-4">
          <h2 className="mb-1 text-base font-semibold">{t(`usage.sections.${section}`)}</h2>
          <p className="text-base-content/60 mb-4 text-xs">{t(`usage.descriptions.${section}`)}</p>

          {failure ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs">{t('usage.failure')}</p>
              <button type="button" className="btn btn-xs" onClick={reload}>
                {t('usage.retry')}
              </button>
            </div>
          ) : report ? (
            <Section id={section} period={period} report={report} />
          ) : (
            <p className="text-base-content/60 text-xs">{t('usage.loading')}</p>
          )}
        </main>
      </div>
    </div>
  )
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
