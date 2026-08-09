import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, emptyAssetCounts, type AssetType } from '@shared/domain/asset'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { revealAssetsOfKind } from '@/helpers/reveal-panel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { Section } from '../Section'
import { useShelf } from '../use-shelf'

const NONE = emptyAssetCounts()

/**
 * What the project holds, one number per kind, each one a way into the shelf.
 *
 * Counted in SQL on the catalogue thread: a home that read the rows to count them would carry a
 * whole project across the boundary to print six integers.
 */
export function ByMode() {
  const { t } = useTranslation()
  const path = useProject(state => state.project?.path ?? null)
  const counts = useShelf(NONE, () => getBridge()?.assets.counts(), [path])

  const total = ASSET_TYPES.reduce((sum, type) => sum + counts[type], 0)
  if (total === 0) return null

  return (
    <Section id="byMode" title={t('home.sections.byMode')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ASSET_TYPES.map(type => (
          <Counter key={type} type={type} total={counts[type]} />
        ))}
      </div>
    </Section>
  )
}

/** A kind with nothing in it stays on the row and stops responding — see `AssetCounts`. */
function Counter({ type, total }: { type: AssetType; total: number }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      disabled={total === 0}
      onClick={() => revealAssetsOfKind(type)}
      className={cn(
        'bg-surface flex items-center gap-2.5 rounded-(--radius-sc-md) border-none px-3 py-2',
        'text-left transition-colors',
        total === 0 ? 'opacity-40' : 'hover:bg-elevated cursor-pointer',
        FOCUS_RING,
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
