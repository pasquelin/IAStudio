import type { ReactNode } from 'react'
import type { AssetType } from '@shared/domain/asset'
import { AssetDropTarget } from '../AssetDropTarget'

export type TextureFieldSlotProps = {
  accepts?: readonly AssetType[]
  onDrop: (assetId: string) => void
  children: ReactNode
}

/**
 * The row itself, made a drop target only where a drop means something.
 *
 * Wrapped rather than made conditional inside the row: `AssetDropTarget` owns the outline that
 * says WHICH slot a drop would land in, and a field that mounted one unconditionally would light
 * up on a drag it has no use for. `exclusive`, because these slots sit inside the panel's own
 * target — without it both would frame at once and the answer would name two places.
 *
 * NOT `AssetDropField`, whose name is one letter away: that one is a form control — it registers
 * with react-hook-form, draws an input, and holds the chosen id itself. This holds nothing.
 */
export function TextureFieldSlot({ accepts, onDrop, children }: TextureFieldSlotProps) {
  /**
   * The height only — `Row` draws the flex line itself, and a second one around it would centre a
   * full-height child inside a box it is already the size of.
   *
   * STATED, and at the stacked gauge: `Row` sizes itself against its parent (`h-full`), which
   * against a `min-height` alone computes to `auto` and gives no height at all. And the gauge is
   * the taller one because this row now stacks two steps of text — `--sc-control` holds 27.5px of
   * them edge to edge in comfort and overflows in compact, which `index.css` says at its own line.
   *
   * The negative inset cancels the one `Row` carries: every list of the studio wants those four
   * pixels, and the inspector is the one place that does not — `FIELD_ROW` has none, deliberately,
   * so that the two families of property line start at the same x.
   *
   * `relative` because this box is what the menu trigger covers. Here rather than on a wrapper of
   * its own: this element is already exactly the row, and a second one inside it would be a node
   * whose only class is `relative`.
   */
  const shape = 'relative h-(--sc-row-stacked) min-w-0 -mx-1'

  if (!accepts) return <div className={shape}>{children}</div>

  return (
    <AssetDropTarget
      accepts={accepts}
      exclusive
      onDrop={asset => onDrop(asset.id)}
      className={shape}
    >
      {children}
    </AssetDropTarget>
  )
}
