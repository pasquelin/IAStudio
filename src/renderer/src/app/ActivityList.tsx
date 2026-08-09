import { mdiAlertCircleOutline, mdiAlertOutline, mdiCheckCircleOutline, mdiHistory } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_TOPICS,
  type ActivityEntry,
  type ActivityLevel,
} from '@shared/domain/activity'
import { EmptyState } from '@/design/EmptyState'
import { Separator } from '@/design/Separator'
import { UiIcon } from '@/design/UiIcon'
import { chipSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useActivity, visibleActivity } from '@/stores/activity'

export const GLYPHS: Record<ActivityLevel, string> = {
  info: mdiCheckCircleOutline,
  warn: mdiAlertOutline,
  error: mdiAlertCircleOutline,
}

/** Exported beside `GLYPHS`: the home draws the same levels, and one of the two tables
 * drifting would make a failure look like one thing there and another here. */
export const TINTS: Record<ActivityLevel, string> = {
  info: 'text-muted',
  warn: 'text-warning',
  error: 'text-danger',
}

/**
 * One formatter per language, kept.
 *
 * `toLocaleTimeString` with an options object builds a fresh `Intl.DateTimeFormat` on every
 * call — 48 µs against 4, which a list of two hundred lines pays on the UI thread.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function timeOf(at: string, language: string): string {
  const stamp = new Date(at)
  if (Number.isNaN(stamp.getTime())) return ''

  const held = FORMATTERS.get(language)
  const formatter =
    held ?? new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' })
  if (!held) FORMATTERS.set(language, formatter)

  return formatter.format(stamp)
}

/**
 * What a line says, and what broke under it. Shared with the toasts: the two showed the same
 * thing written twice, which is how they would have come to show it differently.
 *
 * The detail is `persistableFailure` output — a status and a parsed body, never a stack and
 * never credentials. Small and dim: it is for whoever is asked what went wrong, not for the eye.
 */
export function ActivityMessage({ entry }: { entry: ActivityEntry }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-text text-[11px] break-words">{t(entry.messageKey, entry.params)}</span>
      {entry.detail && (
        <span className="text-muted/70 font-mono text-[10px] break-all">{entry.detail}</span>
      )}
    </div>
  )
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { i18n } = useTranslation()

  return (
    <li className="flex items-start gap-2 px-2 py-1.5">
      <UiIcon path={GLYPHS[entry.level]} size={14} className={cn('mt-px', TINTS[entry.level])} />
      <ActivityMessage entry={entry} />
      <span className="text-muted shrink-0 text-[11px] tabular-nums">
        {timeOf(entry.at, i18n.language)}
      </span>
    </li>
  )
}

/** Nothing selected is "everything" — which is what an empty list means to `matchesActivity`. */
function Chips<T extends string>({
  values,
  active,
  label,
  onToggle,
}: {
  values: readonly T[]
  active: readonly T[]
  label: (value: T) => string
  onToggle: (values: T[]) => void
}) {
  return values.map(value => (
    <button
      key={value}
      type="button"
      aria-pressed={active.includes(value)}
      onClick={() =>
        onToggle(active.includes(value) ? active.filter(one => one !== value) : [...active, value])
      }
      className={chipSkin(active.includes(value))}
    >
      {label(value)}
    </button>
  ))
}

/**
 * What the studio did, and what it failed to do.
 *
 * Filtered here rather than by asking again: the window holds what it was given, so a toggle
 * costs no round trip — and the filters live in the store because this panel is unmounted
 * whenever its flyout closes.
 */
export function ActivityList() {
  const { t } = useTranslation()
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
      <div className="border-border flex flex-wrap items-center gap-2 border-b p-1">
        <Chips
          values={ACTIVITY_LEVELS}
          active={levels}
          label={level => t(`activity.levels.${level}`)}
          onToggle={next => setFilters({ levels: next })}
        />
        <Separator orientation="vertical" />
        <Chips
          values={ACTIVITY_TOPICS}
          active={topics}
          label={topic => t(`activity.topics.${topic}`)}
          onToggle={next => setFilters({ topics: next })}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={mdiHistory}
          message={t(entries.length === 0 ? 'activity.none' : 'activity.noMatch')}
          {...(entries.length > 0 && {
            action: {
              label: t('activity.clearFilters'),
              onClick: () => setFilters({ levels: [], topics: [] }),
            },
          })}
        />
      ) : (
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.map(entry => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  )
}
