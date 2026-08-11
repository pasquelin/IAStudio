import { mdiRefresh } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_USAGE_PERIOD,
  USAGE_PERIODS,
  type UsagePeriod,
  type UsageReport,
} from '@shared/domain/usage'
import { TooltipHost } from '@/design/TooltipHost'
import { UiIcon } from '@/design/UiIcon'
import { CLICKABLE, DRAGGABLE } from '@/helpers/app-region'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM, HINT_RIGHT } from '@/helpers/tooltip'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { UsageActivities } from './UsageActivities'
import { UsageJournal } from './UsageJournal'
import { UsageModels } from './UsageModels'
import { UsageNotes } from './UsageNotes'
import { UsageOverview } from './UsageOverview'
import { useUsageReport } from './useUsageReport'
import { WINDOW_CAPTION } from '@/design/window-styles'

export type UsageSectionId = 'overview' | 'models' | 'activities' | 'journal'

export const SECTIONS: readonly UsageSectionId[] = ['overview', 'models', 'activities', 'journal']

/** Periods, sections and the refresh answer to one look: active is primary, idle is a hover. */
function control(active: boolean): string {
  return cn(
    'flex h-(--sc-control) cursor-pointer items-center rounded-(--radius-sc-sm) border-none text-xs',
    active ? 'bg-primary text-primary-content' : 'hover:bg-base-300 bg-transparent',
  )
}

/**
 * What every stored key has spent, in its own window off the Help menu.
 *
 * Built on the settings window's shape rather than its own: sections on the left, the selected
 * one on the right, the same control heights and the same active colour.
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
        className="text-body flex shrink-0 items-center pt-2 pr-4 pb-2 pl-24 font-medium"
      >
        {t('usage.title')}

        {/* A dragged surface swallows clicks; every control inside has to switch back. */}
        <div
          style={CLICKABLE}
          role="group"
          aria-label={t('usage.period.label')}
          className="ml-auto flex gap-0.5"
        >
          {USAGE_PERIODS.map(days => (
            <button
              key={days}
              type="button"
              aria-pressed={days === period}
              {...HINT_BOTTOM(t('usage.period.hint', { count: days }))}
              onClick={() => setPeriod(days)}
              className={cn(control(days === period), 'justify-center px-2.5 font-normal')}
            >
              {t('usage.period.short', { count: days })}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('usage.title')}
          className="border-base-300 flex w-56 shrink-0 flex-col gap-2 overflow-auto border-r p-2"
        >
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {SECTIONS.map(id => (
              <li key={id}>
                <button
                  type="button"
                  aria-current={id === section ? 'page' : undefined}
                  // The sentence the pane already carries, said before one gets there.
                  {...HINT_RIGHT(t(`usage.descriptions.${id}`))}
                  onClick={() => setSection(id)}
                  className={cn(control(id === section), 'w-full px-3 text-left')}
                >
                  {t(`usage.sections.${id}`)}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            {...HINT_RIGHT(t('usage.refreshHint'))}
            onClick={reload}
            disabled={loading}
            className={cn(
              control(false),
              'mt-auto w-full gap-1.5 px-3 text-left disabled:cursor-default disabled:opacity-50',
            )}
          >
            <UiIcon path={mdiRefresh} size={14} />
            {t('usage.refresh')}
          </button>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto px-6 py-4">
          <h2 className="mb-1 text-base font-semibold">{t(`usage.sections.${section}`)}</h2>
          <p className={cn(WINDOW_CAPTION, 'mb-4')}>{t(`usage.descriptions.${section}`)}</p>

          <Body id={section} period={period} report={report} failure={failure} onRetry={reload} />
        </main>
      </div>

      <TooltipHost />
    </div>
  )
}

type BodyProps = {
  id: UsageSectionId
  period: UsagePeriod
  report: UsageReport | null
  failure: string | null
  onRetry: () => void
}

function Body({ id, period, report, failure, onRetry }: BodyProps) {
  const { t } = useTranslation()

  if (failure) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs">{t('usage.failure')}</p>
        <button
          type="button"
          className="btn btn-xs"
          {...HINT_RIGHT(t('usage.retryHint'))}
          onClick={onRetry}
        >
          {t('usage.retry')}
        </button>
      </div>
    )
  }

  if (!report) return <p className={WINDOW_CAPTION}>{t('usage.loading')}</p>

  // Zeros across the board because nothing was spent, or because there is no key to ask? Only
  // this tells them apart, and a table of zeros reads as the first when it is the second.
  if (report.accounts.length === 0 && report.silent.length === 0) {
    return <p className={WINDOW_CAPTION}>{t('usage.noAccount')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {id === 'overview' && <UsageOverview report={report} />}
      {id === 'models' && <UsageModels report={report} />}
      {id === 'activities' && <UsageActivities report={report} />}
      {id === 'journal' && <UsageJournal period={period} />}

      {/* Once, under whichever screen is open — rather than repeated inside three of them. */}
      <UsageNotes report={report} />
    </div>
  )
}
