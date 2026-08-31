import { mdiFilterVariant } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/components/MenuButton'
import { MenuRow } from '@/components/MenuRow'
import { formatList } from '@/helpers/format'
import { HINT_RIGHT, TIP_BOTTOM } from '@/helpers/tooltip'

/**
 * One family of filters, behind the menu that says what it is filtering on.
 *
 * Eleven chips across two rows used to sit above the journal and take a third of it — the panel
 * spent more height saying what it could show than showing it. Two menus cost one row, and the
 * button keeps the choice readable while it is closed, which is the whole reason the chips were
 * worth keeping in the first place.
 */
export function ActivityListFilterMenu<T extends string>({
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
  //
  // A DISJUNCTION, and the distinction is the whole of it: `matchesActivity` keeps a line whose
  // level is ANY of those chosen, so "warning AND failure" would name a filter no line can meet.
  const chosen =
    active.length === 0
      ? t('activity.all')
      : formatList(active.map(label), i18n.language, 'disjunction')

  const summary = t('activity.filters.summary', { facet, choice: chosen })

  const toggle = (value: T): T[] =>
    active.includes(value) ? active.filter(one => one !== value) : [...active, value]

  return (
    <MenuButton
      icon={mdiFilterVariant}
      // `ToolButton` is square by gauge; a label needs the width back. `ZoomBar` does the same.
      // The other two undo what makes the pair overflow side by side: `ToolButton` is `shrink-0`
      // so neither would ever give ground, and a flex item floors at its content width even once
      // it can — both are needed before the `truncate` below does anything.
      className="w-auto min-w-0 shrink px-1.5"
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
