import { mdiRefresh } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_USAGE_PERIOD, USAGE_PERIODS, type UsagePeriod } from '@shared/domain/usage'
import { UiIcon } from '@/components/UiIcon'
import { WindowChip } from '@/components/WindowChip'
import { WindowShell } from '@/components/WindowShell'
import { CLICKABLE } from '@/helpers/appRegion'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { SECTIONS, type UsageSectionId } from './sections'
import { UsageWindowBody } from './UsageWindowBody'
import { useUsageReport } from '@/hooks/useUsageReport'
import { windowControl, WINDOW_CAPTION } from '@/components/windowStyles'
import { WindowNav } from '@/components/WindowNav/WindowNav'
import { WindowNavItem } from '@/components/WindowNav/WindowNavItem'

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
    <WindowShell
      title={t('usage.title')}
      navLabel={t('usage.title')}
      headerActions={
        // A dragged surface swallows clicks; every control inside has to switch back.
        <div
          style={CLICKABLE}
          role="group"
          aria-label={t('usage.period.label')}
          className="ml-auto flex gap-0.5"
        >
          {USAGE_PERIODS.map(days => (
            <WindowChip
              key={days}
              label={t('usage.period.short', { count: days })}
              hint={t('usage.period.hint', { count: days })}
              selected={days === period}
              onClick={() => setPeriod(days)}
            />
          ))}
        </div>
      }
      nav={
        <>
          {/* The list scrolls, not the column: refresh stays reachable however long the list
              grows, which it did not when the whole nav scrolled. */}
          <WindowNav>
            {SECTIONS.map(id => (
              <WindowNavItem
                key={id}
                active={id === section}
                // The sentence the pane already carries, said before one gets there.
                hint={t(`usage.descriptions.${id}`)}
                onSelect={() => setSection(id)}
                className="px-3"
              >
                {t(`usage.sections.${id}`)}
              </WindowNavItem>
            ))}
          </WindowNav>

          <button
            type="button"
            {...HINT_RIGHT(t('usage.refreshHint'))}
            onClick={reload}
            disabled={loading}
            className={cn(
              windowControl(false),
              'w-full shrink-0 gap-1.5 px-3 text-left disabled:cursor-default disabled:opacity-50',
            )}
          >
            <UiIcon path={mdiRefresh} size={14} />
            {t('usage.refresh')}
          </button>
        </>
      }
    >
      <h2 className="mb-1 text-base font-semibold">{t(`usage.sections.${section}`)}</h2>
      <p className={cn(WINDOW_CAPTION, 'mb-4')}>{t(`usage.descriptions.${section}`)}</p>

      <UsageWindowBody
        id={section}
        period={period}
        report={report}
        failure={failure}
        onRetry={reload}
      />
    </WindowShell>
  )
}
