import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, emptyAssetCounts, type AssetType } from '@shared/domain/asset'
import { UiIcon } from '@/design/UiIcon'
import { rowSkin } from '@/design/styles'
import { HINT_LEFT } from '@/helpers/tooltip'
import { cn } from '@/helpers/cn'
import { revealAssetsOfKind } from '@/helpers/reveal-panel'
import { assetIcon } from '@/helpers/workspaces'
import { useShelf } from '@/hooks/use-shelf'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { RefusedPanel } from '@/panels/shared/RefusedPanel'

const NONE = emptyAssetCounts()

/**
 * What the project holds, one number per kind, each one a way into the shelf.
 *
 * Counted in SQL on the catalogue thread: a panel that read the rows to count them would carry a
 * whole project across the boundary to print six integers.
 *
 * Six rows and never more, so no virtualized collection: `Collection` earns its keep on a list
 * whose length nobody knows, and this one is the length of `ASSET_TYPES`.
 */
export function Counts() {
  const path = useProject(state => state.project?.path ?? null)
  const {
    value: counts,
    state,
    retry,
  } = useShelf(NONE, () => getBridge()?.assets.counts(), path ?? '')

  if (state === 'refused') return <RefusedPanel tool="counts" onRetry={retry} />

  // Drawn at zero rather than taken off: a kind with nothing in it is an answer, and the six
  // rows are what tells the reader the panel has been counted rather than not yet read.
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-2">
      {ASSET_TYPES.map(type => (
        <li key={type}>
          <Counter type={type} total={counts[type]} />
        </li>
      ))}
    </ul>
  )
}

/**
 * A kind with nothing in it stays on the list and stops responding — see `AssetCounts`.
 *
 * `HINT_LEFT` and not a tooltip naming the row: the count and the kind are already on screen, so
 * the sentence has to say what the click DOES — open the shelf, narrowed — which an integer laid
 * on a glyph cannot. `left` because the host is the right column; the placement is the host's.
 */
function Counter({ type, total }: { type: AssetType; total: number }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      disabled={total === 0}
      {...HINT_LEFT(t('home.counts.reveal'))}
      onClick={() => revealAssetsOfKind(type)}
      {...HINT_LEFT(t('home.counts.reveal'))}
      // `rowSkin` rather than the hover and the focus ring written out again: the same line must
      // not light up differently depending on which panel lists it. A count of nothing keeps its
      // place and stops answering — dimmed, and `disabled` takes the hover away on its own.
      className={cn(
        rowSkin(false),
        'bg-surface flex w-full items-center gap-2.5 border-none px-3 py-2 text-left',
        'transition-colors',
        total === 0 ? 'opacity-40' : 'cursor-pointer',
      )}
    >
      <UiIcon path={assetIcon(type)} size={18} className="text-muted shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="text-text text-[14px] font-semibold tabular-nums">{total}</span>
        <span className="text-muted truncate text-[11px]">{t(`assetTypes.${type}`)}</span>
      </span>
    </button>
  )
}
