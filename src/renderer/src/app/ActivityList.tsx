import { mdiAlertCircleOutline, mdiAlertOutline, mdiCheckCircleOutline, mdiHistory } from '@mdi/js'
import type { TFunction } from 'i18next'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_TOPICS,
  type ActivityEntry,
  type ActivityLevel,
  type ActivityParams,
} from '@shared/domain/activity'
import { isWorkspaceId } from '@shared/domain/workspace'
import { EmptyState } from '@/design/EmptyState'
import { UiIcon } from '@/design/UiIcon'
import { chipSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { workspaceLabelKey } from '@/helpers/workspaces'
import { useActivity, visibleActivity } from '@/stores/activity'
import { HINT_TOP } from '@/helpers/tooltip'

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
/**
 * A line's params, with the id lists turned into words.
 *
 * The journal stores ids so a line survives a change of language, which leaves this the one
 * place that can say them out loud. Only workspace ids are listed today; an id nothing names
 * is left as it is rather than dropped — a shelf missing from a sentence reads as a bug, an
 * untranslated one reads as a shelf.
 */
function namedParams(params: ActivityParams | undefined, t: TFunction): ActivityParams | undefined {
  if (!params) return params

  const named: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(params)) {
    // Narrowed by what it is not: `Array.isArray` leaves a `readonly string[]` unnarrowed.
    named[name] =
      typeof value === 'string' || typeof value === 'number'
        ? value
        : value.map(id => (isWorkspaceId(id) ? t(workspaceLabelKey(id)) : id)).join(', ')
  }
  return named
}

export function ActivityMessage({ entry }: { entry: ActivityEntry }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-text text-[11px] break-words">
        {t(entry.messageKey, namedParams(entry.params, t))}
      </span>
      {entry.detail && (
        <span className="text-muted/70 font-mono text-[10px] break-all">{entry.detail}</span>
      )}
    </div>
  )
}

/**
 * One journal line, wherever it is read. Written twice, the two had each kept half of it: the
 * panel had `tabular-nums` but no `shrink-0`, so a long message squeezed its level glyph; the
 * home had `shrink-0` but no `tabular-nums`, so its timestamps did not line up down the column.
 *
 * It carries its own padding, like `ProgressRow` — the row on the band beside it in the home,
 * which indents by `px-2` where this one indented by `px-1`. Two bands stacked on the same shelf
 * and starting at different columns is drift, not a density anyone chose.
 *
 * `time` is handed over already written: the panel states the hour and the home says how long
 * ago, and that difference is the one worth keeping. `null` for a stamp neither can read.
 */
export function ActivityRow({ entry, time }: { entry: ActivityEntry; time: string | null }) {
  return (
    <li className="flex items-start gap-2 px-2 py-1.5">
      <UiIcon
        path={GLYPHS[entry.level]}
        size={14}
        className={cn('mt-px shrink-0', TINTS[entry.level])}
      />
      <ActivityMessage entry={entry} />
      <span className="text-muted shrink-0 text-[11px] tabular-nums">{time}</span>
    </li>
  )
}

// A row per family rather than one wrap: past seven chips the break fell after the separator,
// wrapping the subjects away from the hairline that announced them.
function FilterRow<T extends string>({
  name,
  allLabel,
  values,
  active,
  label,
  onChange,
}: {
  name: string
  allLabel: string
  values: readonly T[]
  active: readonly T[]
  label: (value: T) => string
  onChange: (values: T[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={name} className="flex flex-wrap items-center gap-2">
      {/* Nothing selected is "everything" to `matchesActivity`, so this clears rather than adds.
          Pressed, it no longer answers — like a radio, and unlike the toggle `aria-pressed` names.
          Kept because the state is true and drawn: dropping it would tell the eye what it hides
          from a screen reader. */}
      <button
        type="button"
        aria-pressed={active.length === 0}
        {...HINT_TOP(t('activity.allHint'))}
        onClick={() => onChange([])}
        className={chipSkin(active.length === 0)}
      >
        {allLabel}
      </button>

      {values.map(value => (
        <button
          key={value}
          type="button"
          aria-pressed={active.includes(value)}
          {...HINT_TOP(t('activity.filterHint'))}
          onClick={() =>
            onChange(
              active.includes(value) ? active.filter(one => one !== value) : [...active, value],
            )
          }
          className={chipSkin(active.includes(value))}
        >
          {label(value)}
        </button>
      ))}
    </div>
  )
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
      <div className="border-border flex flex-col gap-1.5 border-b p-1">
        <FilterRow
          name={t('activity.filters.levels')}
          allLabel={t('activity.all')}
          values={ACTIVITY_LEVELS}
          active={levels}
          label={level => t(`activity.levels.${level}`)}
          onChange={next => setFilters({ levels: next })}
        />
        <FilterRow
          name={t('activity.filters.topics')}
          allLabel={t('activity.all')}
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
              onClick: () => setFilters({ levels: [], topics: [] }),
            },
          })}
        />
      ) : (
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.map(entry => (
            <ActivityRow key={entry.id} entry={entry} time={timeOf(entry.at, i18n.language)} />
          ))}
        </ul>
      )}
    </div>
  )
}
