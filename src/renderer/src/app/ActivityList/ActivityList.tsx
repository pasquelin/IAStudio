import { mdiHistory } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ACTIVITY_LEVELS, ACTIVITY_TOPICS } from '@shared/domain/activity'
import { EmptyState } from '@/design/EmptyState'
import { kept } from '@/helpers/format'
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

  // No `timeZone`, and that is the decision rather than the omission: this is the clock on the
  // wall of whoever is working, for things that just happened in front of them. The usage window
  // is the one that had to leave it — its rows sit beside totals the API counted in UTC.
  return kept(
    FORMATTERS,
    language,
    () => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }),
  ).format(stamp)
}

/**
 * What the studio did, and what it failed to do.
 *
 * Filtered here rather than by asking again: the window holds what it was given, so a toggle
 * costs no round trip — and the filters live in the store because this panel is unmounted
 * whenever its flyout closes.
 */
export function ActivityList() {
  const { t, i18n } = useTranslation()
  const entries = useActivity(state => state.entries)
  const levels = useActivity(state => state.levels)
  const topics = useActivity(state => state.topics)

  // Derived here rather than in a selector: zustand compares snapshots by identity, and a
  // selector returning a fresh array renders, derives, and renders again until React gives up.
  const visible = useMemo(
    () => visibleActivity(entries, { levels, topics }),
    [entries, levels, topics],
  )

  const setFilters = useActivity(state => state.setFilters)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Stacked, each took the panel's whole width to say it was filtering nothing, which reads
          as two fields waiting to be filled rather than as two filters that are off. */}
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
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.map(entry => (
            <ActivityListRow key={entry.id} entry={entry} time={timeOf(entry.at, i18n.language)} />
          ))}
        </ul>
      )}
    </div>
  )
}
