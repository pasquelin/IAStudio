import type { AssetType } from '@shared/domain/asset'
import { cn } from '@/helpers/cn'
import { assetIcon } from '@/helpers/workspaces'
import { UiIcon } from './UiIcon'

export type AssetTypeMarkProps = {
  type: AssetType
  /** Resolved by the panel — translating per tile runs i18next per frame. */
  label: string
}

/**
 * The corner mark that says WHAT an asset is.
 *
 * Beside `AssetBadge`, which says where it lives, and in the other corner for that reason. The
 * two answer different questions and a tile needs both: a mesh whose thumbnail has been rendered
 * and a picture look exactly alike, and the shelf's own fallback glyph only ever shows on the
 * tiles that have no thumbnail at all — which is to say, never on the ones worth telling apart.
 *
 * The glyph is the SPACE's, read off the same table as the rail and the document tabs: a `.glb`
 * wears the cube it wears everywhere else, or the studio has two vocabularies for one thing.
 */
export function AssetTypeMark({ type, label }: AssetTypeMarkProps) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute top-1 left-1 inline-flex items-center',
        'bg-chassis/75 text-muted rounded-(--radius-sc-sm) p-px',
      )}
      // The glyph carries the meaning, so it needs the words a picture cannot give.
      title={label}
      aria-label={label}
      role="img"
    >
      <UiIcon path={assetIcon(type)} size={12} />
    </span>
  )
}
