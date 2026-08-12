import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiFilterVariant,
  mdiHistory,
} from '@mdi/js'
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
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { cn } from '@/helpers/cn'
import { formatList, kept } from '@/helpers/format'
import { workspaceLabelKey } from '@/helpers/workspaces'
import { useActivity, visibleActivity } from '@/stores/activity'
import { HINT_RIGHT, TIP_BOTTOM } from '@/helpers/tooltip'

export const GLYPHS: Record<ActivityLevel, string> = {
  info: mdiCheckCircleOutline,
  warn: mdiAlertOutline,
  error: mdiAlertCircleOutline,
}

/**
 * Read by the rows of this file alone. It was exported beside `GLYPHS` for a home that would
 * draw the same levels, and no site ever did — the toasts, the only other reader, hold nothing
 * but failures and paint them all in the one red.
 */
const TINTS: Record<ActivityLevel, string> = {
  info: 'text-muted',
  warn: 'text-warning',
  error: 'text-danger',
}

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
function namedParams(
  params: ActivityParams | undefined,
  t: TFunction,
  language: string,
): ActivityParams | undefined {
  if (!params) return params

  const named: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(params)) {
    // Narrowed by what it is not: `Array.isArray` leaves a `readonly string[]` unnarrowed.
    named[name] =
      typeof value === 'string' || typeof value === 'number'
        ? value
        : formatList(
            value.map(id => (isWorkspaceId(id) ? t(workspaceLabelKey(id)) : id)),
            language,
          )
  }
  return named
}

export function ActivityMessage({ entry }: { entry: ActivityEntry }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-text text-tiny break-words">
        {t(entry.messageKey, namedParams(entry.params, t, i18n.language))}
      </span>
      {entry.detail && (
        <span className="text-muted/70 text-mini font-mono break-all">{entry.detail}</span>
      )}
    </div>
  )
}

/**
 * One journal line. Written twice once — the panel had `tabular-nums` but no `shrink-0`, so a
 * long message squeezed its level glyph; the home band had `shrink-0` but no `tabular-nums`, so
 * its timestamps did not line up down the column. The band is gone; the row it forced is right.
 *
 * It carries its own padding, like `ProgressRow`, which indents by `px-2` where this one indented
 * by `px-1`. Two bands stacked on the same shelf and starting at different columns is drift, not
 * a density anyone chose.
 *
 * `time` is handed over already written: an hour and an "how long ago" are the same row said to
 * two different readers. `null` for a stamp neither can read.
 */
function ActivityRow({ entry, time }: { entry: ActivityEntry; time: string | null }) {
  return (
    <li className="flex items-start gap-2 px-2 py-1.5">
      <UiIcon
        path={GLYPHS[entry.level]}
        size={14}
        className={cn('mt-px shrink-0', TINTS[entry.level])}
      />
      <ActivityMessage entry={entry} />
      <span className="text-muted text-tiny shrink-0 tabular-nums">{time}</span>
    </li>
  )
}

/**
 * One family of filters, behind the menu that says what it is filtering on.
 *
 * Eleven chips across two rows used to sit above the journal and take a third of it — the panel
 * spent more height saying what it could show than showing it. Two menus cost one row, and the
 * button keeps the choice readable while it is closed, which is the whole reason the chips were
 * worth keeping in the first place.
 */
function FilterMenu<T extends string>({
  facet,
  values,
  active,
  label,
  icon,
  onChange,
}: {
  facet: string
  values: readonly T[]
  active: readonly T[]
  label: (value: T) => string
  /** Absent for a family whose values have no glyph of their own — the subjects. */
  icon?: (value: T) => string
  onChange: (values: T[]) => void
}) {
  const { t, i18n } = useTranslation()

  // The names rather than a count: "Level: warning" is what the reader wants back, and a count
  // would make them open the menu to learn what they had chosen. Truncation handles the long tail.
  // Joined the way this file's other enumeration is (`namedParams`), rather than through a key
  // both bundles spell the same — a separator that translates nothing is a promise it cannot keep.
  const chosen =
    active.length === 0 ? t('activity.all') : formatList(active.map(label), i18n.language)

  const summary = t('activity.filters.summary', { facet, choice: chosen })

  const toggle = (value: T): T[] =>
    active.includes(value) ? active.filter(one => one !== value) : [...active, value]

  return (
    <MenuButton
      icon={mdiFilterVariant}
      // `ToolButton` is square by gauge; a label needs the width back. `ZoomBar` does the same.
      className="w-auto px-1.5"

      // The accessible name IS the visible text: `ToolButton` names itself from `label`, and a
      // name that did not contain what the eye reads breaks WCAG 2.5.3.
      label={summary}
      description={t('activity.filters.hint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      active={active.length > 0}
      rowCount={values.length + 1}
      opensOnClick
      rows={() => (
        <>
          {/* Nothing selected is "everything" to `matchesActivity`, so this CLEARS rather than
              adds — and it is ticked when the family filters nothing, which is the true state. */}
          <MenuRow
            label={t('activity.all')}
            tick="on-off"
            checked={active.length === 0}
            tip={HINT_RIGHT(t('activity.allHint'))}
            onSelect={() => onChange([])}
          />
          {values.map(value => (
            <MenuRow
              key={value}
              label={label(value)}
              icon={icon?.(value)}
              tick="on-off"
              checked={active.includes(value)}
              tip={HINT_RIGHT(t('activity.filterHint'))}
              onSelect={() => onChange(toggle(value))}
            />
          ))}
        </>
      )}
    >
      <span className="truncate">{summary}</span>
    </MenuButton>
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
        <FilterMenu
          facet={t('activity.filters.levels')}
          values={ACTIVITY_LEVELS}
          active={levels}
          label={level => t(`activity.levels.${level}`)}
          icon={level => GLYPHS[level]}
          onChange={next => setFilters({ levels: next })}
        />
        <FilterMenu
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
            <ActivityRow key={entry.id} entry={entry} time={timeOf(entry.at, i18n.language)} />
          ))}
        </ul>
      )}
    </div>
  )
}
