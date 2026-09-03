import { mdiFormatListBulleted, mdiMinus, mdiPlus, mdiViewGridOutline } from '@mdi/js'
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
} from '@/helpers/collectionState'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { FoldRule } from '../FoldRule'
import { PANEL_BAR, PANEL_HEAD } from '../styles'
import { ToolButton } from '../ToolButton'
import { SearchField } from '../SearchField'
import { SelectField } from '../SelectField'

/** Facets shown before the fold — one row of the grid. The rest hide behind the toggle. */
const FACETS_BEFORE_FOLD = 2

/**
 * `stacked` for a side dock — narrow and tall, so the controls go on their own rows.
 * `inline` for an edge dock — wide and short, where stacking would eat the content area and
 * stretch a single dropdown across the whole window.
 * `header` is `inline` on the panel's own title row, which already draws the surface: the bar
 * brings its controls and no rule, no padding of its own.
 */
export type CollectionLayout = 'stacked' | 'inline' | 'header'

export type CollectionBarProps = {
  /**
   * Which collection this bar drives, for the handles it writes. Required, and that is the point:
   * three panels can be docked at once, and one shared `field:collection.search` would leave a
   * script driving whichever of the three the DOM happened to hold first.
   */
  scId: string
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
  /**
   * Drawn on the search field's own line, before it — for what a panel navigates its collection
   * WITH, and which would otherwise cost a row of its own in a side dock.
   */
  leading?: ReactNode
  /** Lets one horizontal collection give every spare pixel to its search field. */
  growSearch?: boolean
  className?: string
}

/** Search, facets, sort, view and thumbnail size. It filters nothing — it reports intent. */
export function CollectionBar({
  scId,
  state,
  onChange,
  facets,
  sorts,
  layout = 'stacked',
  display = true,
  leading,
  growSearch = false,
  className,
}: CollectionBarProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  // A header bar is an inline one the panel's own row already provides the surface for.
  const inline = layout !== 'stacked'

  const search = (
    <SearchField
      label={t('collection.search')}
      value={state.search}
      onChange={value => onChange({ ...state, search: value })}
      scId={`${scId}.search`}
      // In a header the row is shared with the panel's name and its way out, so the field is
      // what gives ground — a narrow search box still searches, a clipped one is unreachable.
      className={
        growSearch
          ? 'min-w-16 flex-1'
          : layout === 'header'
            ? 'w-56 min-w-16 shrink'
            : inline
              ? 'w-56 shrink-0'
              : 'w-full'
      }
      // The placeholder says it, but only until the field is typed in.
      hint={TIP_BOTTOM(t('collection.search'), undefined, t('collection.searchHint'))}
    />
  )

  const menusOf = (shown: readonly FacetDescriptor[]): ReactNode[] =>
    shown.map((facet, index) => (
      <SelectField
        key={facet.key}
        layout="bar"
        label={facet.label}
        // The facet's own key: its label is what the panel that declared it chose to show.
        scId={`${scId}.facet.${facet.key}`}
        hint={TIP_BOTTOM(facet.label)}
        // The facet's own name stands for "no choice": once a value is picked, the closed control
        // shows the value and what it filters on is nowhere on screen.
        options={[{ value: '', label: facet.label }, ...facet.options]}
        value={selectedValues(state, facet.key)[0] ?? ''}
        onChange={value => onChange(setFacetValue(state, facet.key, value || null))}
        // An odd last one spans both columns rather than leaving a hole beside it.
        className={index === shown.length - 1 && shown.length % 2 === 1 ? 'col-span-2' : undefined}
      />
    ))

  const menus = menusOf(facets ?? [])

  const sortMenu = sorts && sorts.length > 0 && (
    <SelectField
      layout="bar"
      label={t('collection.sort')}
      scId={`${scId}.sort`}
      hint={TIP_BOTTOM(t('collection.sort'))}
      options={sorts}
      value={state.sort ?? sorts[0]?.value ?? ''}
      onChange={sort => onChange({ ...state, sort })}
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
          layout === 'header'
            ? 'flex min-w-0 flex-1 items-center gap-2'
            : cn(PANEL_BAR, 'px-2 py-1.5'),
          className,
        )}
      >
        {leading}
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
    <div className={cn(PANEL_HEAD, className)}>
      {leading ? (
        <div className="flex items-center gap-2">
          {leading}
          {search}
        </div>
      ) : (
        search
      )}

      {/* Two to a row: a tool window is too narrow for a single line of dropdowns, and
          wrapping them freely reflows the whole bar as soon as a label changes length. */}
      {visible.length > 0 && <div className="grid grid-cols-2 gap-2">{menusOf(visible)}</div>}

      {/* Six menus stacked leave a panel with more filter than collection. The rule doubles as
          the control: it separates the filters from the display options, and opens them. */}
      {folded && (
        <FoldRule
          open={expanded}
          onToggle={() => setExpanded(current => !current)}
          moreLabel={t('collection.more')}
          fewerLabel={t('collection.fewer')}
          moreHint={t('collection.moreHint')}
          fewerHint={t('collection.fewerHint')}
          scId="collection.facets"
        />
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
