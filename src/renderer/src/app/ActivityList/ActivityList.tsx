import { mdiHistory, mdiOpenInNew } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ACTIVITY_LEVELS, ACTIVITY_TOPICS } from '@shared/domain/activity'
import { EmptyState } from '@/components/EmptyState'
import { ToolButton } from '@/components/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { kept } from '@/helpers/format'
import { useRemeasure } from '@/hooks/useRemeasure'
import { useRowHeight } from '@/hooks/useRowHeight'
import { useActivity, visibleActivity } from '@/stores/activity'
import { GLYPHS } from './activityLevels'
import { ActivityListFilterMenu } from './ActivityListFilterMenu'
import { ActivityListRow } from './ActivityListRow'

/**
 * Kept, like every `Intl` formatter here: `toLocaleTimeString` with an options object builds a
 * fresh one on every call — 48 µs against 4, which a list of two hundred lines pays on the UI
 * thread.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function timeOf(at: string, language: string): string {
  const stamp = new Date(at)
  if (Number.isNaN(stamp.getTime())) return ''

  return kept(
    FORMATTERS,
    language,
    () => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }),
  ).format(stamp)
}

export function ActivityList({ whole }: { whole?: boolean }) {
  const { t, i18n } = useTranslation()
  const entries = useActivity(state => state.entries)
  const levels = useActivity(state => state.levels)
  const topics = useActivity(state => state.topics)
  const scroll = useRef<HTMLDivElement>(null)
  const rowHeight = useRowHeight('control')

  const visible = useMemo(
    () => visibleActivity(entries, { levels, topics }),
    [entries, levels, topics],
  )

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => rowHeight,
    measureElement: element => element.getBoundingClientRect().height,
    overscan: 12,
  })
  useRemeasure(virtualizer, rowHeight)

  const setFilters = useActivity(state => state.setFilters)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center gap-1.5 border-b p-1">
        <ActivityListFilterMenu
          facet={t('activity.filters.levels')}
          values={ACTIVITY_LEVELS}
          active={levels}
          label={level => t(`activity.levels.${level}`)}
          icon={level => GLYPHS[level]}
          onChange={next => setFilters({ levels: next })}
        />
        <ActivityListFilterMenu
          facet={t('activity.filters.topics')}
          values={ACTIVITY_TOPICS}
          active={topics}
          label={topic => t(`activity.topics.${topic}`)}
          onChange={next => setFilters({ topics: next })}
        />

        {/* Not in the window it opens: a button that raises what one is already reading. */}
        {!whole && (
          <ToolButton
            icon={mdiOpenInNew}
            label={t('activity.openWindow')}
            description={t('activity.openWindowHint')}
            tooltip={TIP_BOTTOM}
            variant="header"
            className="ml-auto"
            onClick={() => void getBridge()?.help.open('journal')}
          />
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={mdiHistory}
          message={t(entries.length === 0 ? 'activity.none' : 'activity.noMatch')}
          {...(entries.length > 0 && {
            action: {
              label: t('activity.clearFilters'),
              hint: t('activity.allHint'),
              onClick: () => setFilters({ levels: [], topics: [] }),
            },
          })}
        />
      ) : (
        <div ref={scroll} role="list" className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map(item => {
              const entry = visible[item.index]
              if (!entry) return null
              return (
                <div
                  // 🛑 The pair, as the toasts key: `id` is a rowid of the OPEN project's
                  // catalogue and restarts at 1 for each one. Reused, React hands one line's
                  // node to another — and `measureElement` then files that height under the
                  // WRONG index, which is how rows came to draw over each other.
                  key={`${entry.at}-${entry.id}`}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <ActivityListRow
                    entry={entry}
                    time={timeOf(entry.at, i18n.language)}
                    clamp={!whole}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
