import {
  mdiChevronDown,
  mdiFormatListBulleted,
  mdiMagnify,
  mdiMinus,
  mdiPlus,
  mdiViewGridOutline,
} from '@mdi/js'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import {
  resizeThumbnails,
  selectedValues,
  setFacetValue,
  THUMBNAIL_STEP,
  type CollectionState,
  type FacetDescriptor,
  type FacetOption,
} from '@/helpers/collection-state'
import { HINT_TOP, TIP_BOTTOM } from '@/helpers/tooltip'
import { CONTROL } from '../styles'
import { ToolButton } from '../ToolButton'
import { UiIcon } from '../UiIcon'

type DropdownProps = {
  label: string
  options: readonly FacetOption[]
  value: string
  onPick: (value: string) => void
  /** The entry standing for "no choice"; absent makes the dropdown a required pick. */
  anyLabel?: string
  className?: string
}

/** Facets shown before the fold — one row of the grid. The rest hide behind the toggle. */
const FACETS_BEFORE_FOLD = 2

/**
 * A native `<select>`, and deliberately so. A tool window is narrow, and a menu drawn inside
 * the panel gets clipped by its edge; the platform draws this one above the window itself.
 *
 * Its own chevron is dropped — the browser pins that one to the edge of the control, where no
 * padding can reach it — and drawn here instead. Only the closed control is restyled; the
 * open menu stays the platform's, which is the whole point of using a `<select>`.
 */
function Dropdown({ label, options, value, onPick, anyLabel, className }: DropdownProps) {
  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      {/* Tipped with the facet's name: once a value is picked, the closed control shows the
          value and the name it filters on is nowhere on screen. */}
      <select
        {...TIP_BOTTOM(label)}
        value={value}
        onChange={event => onPick(event.target.value)}
        className={cn(
          CONTROL,
          'w-full min-w-0 cursor-pointer appearance-none border-none pr-6 pl-2',
          !value && 'text-muted',
        )}
      >
        {anyLabel !== undefined && <option value="">{anyLabel}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <UiIcon
        path={mdiChevronDown}
        size={12}
        className="text-muted pointer-events-none absolute right-2"
      />
    </div>
  )
}

/**
 * `stacked` for a side dock — narrow and tall, so the controls go on their own rows.
 * `inline` for an edge dock — wide and short, where stacking would eat the content area and
 * stretch a single dropdown across the whole window.
 * `header` is `inline` on the panel's own title row, which already draws the surface: the bar
 * brings its controls and no rule, no padding of its own.
 */
export type CollectionLayout = 'stacked' | 'inline' | 'header'

export type CollectionBarProps = {
  state: CollectionState
  onChange: (next: CollectionState) => void
  facets?: readonly FacetDescriptor[]
  /** Sort orders offered; the first one is what an unset `state.sort` means. */
  sorts?: readonly FacetOption[]
  layout?: CollectionLayout
  /**
   * Whether the half that changes how the collection LOOKS — grid or list, thumbnail size — is
   * drawn. A tree has neither, and four buttons that would do nothing take the width a search
   * field needs in a side column.
   */
  display?: boolean
  className?: string
}

/** Search, facets, sort, view and thumbnail size. It filters nothing — it reports intent. */
export function CollectionBar({
  state,
  onChange,
  facets,
  sorts,
  layout = 'stacked',
  display = true,
  className,
}: CollectionBarProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  // A header bar is an inline one the panel's own row already provides the surface for.
  const inline = layout !== 'stacked'

  const search = (
    <label
      className={cn(
        'relative flex items-center',
        // In a header the row is shared with the panel's name and its way out, so the field is
        // what gives ground — a narrow search box still searches, a clipped one is unreachable.
        layout === 'header' ? 'w-56 min-w-16 shrink' : inline ? 'w-56 shrink-0' : 'w-full',
      )}
    >
      <UiIcon
        path={mdiMagnify}
        size={14}
        className="text-muted pointer-events-none absolute left-2"
      />
      <input
        type="search"
        value={state.search}
        // The placeholder says it, but only until the field is typed in.
        {...TIP_BOTTOM(t('collection.search'), undefined, t('collection.searchHint'))}
        placeholder={t('collection.search')}
        onChange={event => onChange({ ...state, search: event.target.value })}
        className={cn(CONTROL, 'w-full py-0 pr-2 pl-7')}
      />
    </label>
  )

  const menusOf = (shown: readonly FacetDescriptor[]): ReactNode[] =>
    shown.map((facet, index) => (
      <Dropdown
        key={facet.key}
        label={facet.label}
        options={facet.options}
        anyLabel={facet.label}
        value={selectedValues(state, facet.key)[0] ?? ''}
        onPick={value => onChange(setFacetValue(state, facet.key, value || null))}
        // An odd last one spans both columns rather than leaving a hole beside it.
        className={index === shown.length - 1 && shown.length % 2 === 1 ? 'col-span-2' : undefined}
      />
    ))

  const menus = menusOf(facets ?? [])

  const sortMenu = sorts && sorts.length > 0 && (
    <Dropdown
      label={t('collection.sort')}
      options={sorts}
      value={state.sort ?? sorts[0]?.value ?? ''}
      onPick={value => onChange({ ...state, sort: value })}
    />
  )

  const views = (
    <div className="flex items-center gap-2">
      <ToolButton
        icon={mdiViewGridOutline}
        label={t('collection.gridView')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={state.view === 'grid'}
        accented={state.view === 'grid'}
        onClick={() => onChange({ ...state, view: 'grid' })}
      />
      <ToolButton
        icon={mdiFormatListBulleted}
        label={t('collection.listView')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={state.view === 'list'}
        accented={state.view === 'list'}
        onClick={() => onChange({ ...state, view: 'list' })}
      />
    </div>
  )

  const zoom = (
    <div className="flex items-center gap-2">
      <ToolButton
        icon={mdiMinus}
        label={t('collection.smaller')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={state.view === 'list'}
        onClick={() => onChange(resizeThumbnails(state, -1 * THUMBNAIL_STEP))}
      />
      <ToolButton
        icon={mdiPlus}
        label={t('collection.larger')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={state.view === 'list'}
        onClick={() => onChange(resizeThumbnails(state, THUMBNAIL_STEP))}
      />
    </div>
  )

  /**
   * One line, the way a content browser lays its own out: what narrows the collection on the
   * left, what only changes its appearance pushed to the right.
   */
  if (inline) {
    return (
      <div
        className={cn(
          'flex items-center gap-2',
          layout === 'header' ? 'min-w-0 flex-1' : 'border-border border-b px-2 py-1.5',
          className,
        )}
      >
        {search}
        {menus}
        <div className="ml-auto flex items-center gap-2">
          {sortMenu}
          {display && views}
          {display && zoom}
        </div>
      </div>
    )
  }

  const all = facets ?? []
  const folded = all.length > FACETS_BEFORE_FOLD
  const visible = expanded || !folded ? all : all.slice(0, FACETS_BEFORE_FOLD)

  return (
    <div className={cn('border-border flex flex-col gap-2 border-b p-2', className)}>
      {search}

      {/* Two to a row: a tool window is too narrow for a single line of dropdowns, and
          wrapping them freely reflows the whole bar as soon as a label changes length. */}
      {visible.length > 0 && <div className="grid grid-cols-2 gap-2">{menusOf(visible)}</div>}

      {/* Six menus stacked leave a panel with more filter than collection. The rule doubles as
          the control: it separates the filters from the display options, and opens them. */}
      {folded && (
        <button
          type="button"
          aria-expanded={expanded}
          {...HINT_TOP(t(expanded ? 'collection.fewerHint' : 'collection.moreHint'))}
          onClick={() => setExpanded(current => !current)}
          className="group flex cursor-pointer items-center gap-2 py-0.5"
        >
          <span className="border-border flex-1 border-t" />
          <span className="text-muted group-hover:text-text text-mini transition-colors">
            {expanded ? t('collection.fewer') : t('collection.more')}
          </span>
          <span className="border-border flex-1 border-t" />
        </button>
      )}

      <div className="flex items-center justify-between">
        {display && views}
        <div className="flex items-center gap-2">
          {sortMenu}
          {display && zoom}
        </div>
      </div>
    </div>
  )
}
