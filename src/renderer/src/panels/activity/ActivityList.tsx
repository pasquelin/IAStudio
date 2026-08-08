import { mdiAlertCircleOutline, mdiAlertOutline, mdiCheckCircleOutline, mdiHistory } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_TOPICS,
  type ActivityEntry,
  type ActivityLevel,
} from '@shared/domain/activity'
import { EmptyState } from '@/design/EmptyState'
import { UiIcon } from '@/design/UiIcon'
import { CONTROL } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useActivity, visibleActivity } from '@/stores/activity'

const GLYPHS: Record<ActivityLevel, string> = {
  info: mdiCheckCircleOutline,
  warn: mdiAlertOutline,
  error: mdiAlertCircleOutline,
}

const TINTS: Record<ActivityLevel, string> = {
  info: 'text-muted',
  warn: 'text-warning',
  error: 'text-danger',
}

/** The hour and minute. The day is noise for a journal one reads to see what just happened. */
function timeOf(at: string, language: string): string {
  const stamp = new Date(at)
  return Number.isNaN(stamp.getTime())
    ? ''
    : stamp.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { t, i18n } = useTranslation()

  return (
    <li className="flex items-start gap-2 px-2 py-1.5 text-[11px]">
      <UiIcon path={GLYPHS[entry.level]} size={14} className={cn('mt-px', TINTS[entry.level])} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-text break-words">{t(entry.messageKey, entry.params)}</span>

        {/* `describeFailure` output: a status and a parsed body, which the credentials never
            travel in. Small and dim — it is for whoever is asked what went wrong, not the eye. */}
        {entry.detail && (
          <span className="text-muted/70 font-mono text-[10px] break-all">{entry.detail}</span>
        )}
      </div>

      <span className="text-muted shrink-0 tabular-nums">{timeOf(entry.at, i18n.language)}</span>
    </li>
  )
}

/** A row of toggles per axis. Nothing selected is "everything", which is what an empty list means. */
function Filters() {
  const { t } = useTranslation()
  const levels = useActivity(state => state.levels)
  const topics = useActivity(state => state.topics)

  const toggle = <T,>(current: readonly T[], value: T): T[] =>
    current.includes(value) ? current.filter(one => one !== value) : [...current, value]

  return (
    <div className="border-border flex flex-wrap items-center gap-1 border-b p-1">
      {ACTIVITY_LEVELS.map(level => (
        <button
          key={level}
          type="button"
          aria-pressed={levels.includes(level)}
          onClick={() => useActivity.getState().setLevels(toggle(levels, level))}
          className={cn(
            CONTROL,
            'cursor-pointer border-none px-2',
            levels.includes(level) ? 'bg-accent-soft text-text' : 'text-muted bg-transparent',
          )}
        >
          {t(`activity.levels.${level}`)}
        </button>
      ))}

      <span className="bg-border mx-1 h-3 w-px" />

      {ACTIVITY_TOPICS.map(topic => (
        <button
          key={topic}
          type="button"
          aria-pressed={topics.includes(topic)}
          onClick={() => useActivity.getState().setTopics(toggle(topics, topic))}
          className={cn(
            CONTROL,
            'cursor-pointer border-none px-2',
            topics.includes(topic) ? 'bg-accent-soft text-text' : 'text-muted bg-transparent',
          )}
        >
          {t(`activity.topics.${topic}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * What the studio did, and what it failed to do.
 *
 * Filtered here rather than by asking again: the whole journal is already held, so a toggle
 * costs no round trip — and the panel keeps its filters while its flyout is closed, which is
 * why they live in the store.
 */
export function ActivityList() {
  const { t } = useTranslation()
  const entries = useActivity(visibleActivity)
  const total = useActivity(state => state.entries.length)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Filters />

      {entries.length === 0 ? (
        <EmptyState
          icon={mdiHistory}
          message={t(total === 0 ? 'activity.none' : 'activity.noMatch')}
          {...(total > 0 && {
            action: {
              label: t('activity.clearFilters'),
              onClick: () => {
                useActivity.getState().setLevels([])
                useActivity.getState().setTopics([])
              },
            },
          })}
        />
      ) : (
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
          {entries.map(entry => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  )
}
