import type { ReactNode } from 'react'
import { assetUrl, posterUrl, type Asset } from '@shared/domain/asset'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { Row } from '@/design/Row'
import { FIELD_THUMBNAIL, OVERLAY_BUTTON, rowSkin } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'

/**
 * One line of this section: a picture, what it is over what kind of thing it is, and a press that
 * opens it.
 *
 * `rowSkin` at its DEFAULT surface, which is the one that does not answer the pointer: no line of
 * the inspector fills under it, decided on 2026-08-14 and held by `design/styles.test.ts`, which
 * names the two surfaces still allowed to. The cost is stated rather than hidden — nothing now
 * tells a line one can open from a line one only reads, and what says a row opens is its tooltip.
 *
 * The press is laid OVER the row rather than around it, as `ChannelTile` does and for the same
 * reason `OVERLAY_BUTTON` gives. It covers the whole line, which is also what keeps the two
 * tooltips of a row from answering different things — the pointer never reaches the name's own
 * anchor.
 */
export function ModelTexturesSectionRow({
  media,
  title,
  subtitle,
  label,
  hint,
  onOpen,
}: {
  media: ReactNode
  title: string
  subtitle: string
  label: string
  hint: string
  onOpen: () => void
}) {
  return (
    <div className={cn('relative h-(--sc-row-stacked)', rowSkin(false))}>
      <Row media={media} title={title} subtitle={subtitle} />
      <button
        type="button"
        {...activation(onOpen)}
        {...TIP_LEFT(label, false, hint)}
        className={cn(OVERLAY_BUTTON, 'rounded-(--radius-sc-sm)')}
      />
    </div>
  )
}

/**
 * The picture as this panel draws it: straight off the row the catalogue answered with, rather
 * than through `usePosterUrl` — the asset is in hand, and it is fresher than the shelf, which is
 * scoped by space.
 */
export const pictureOf = (asset: Asset): ReactNode => (
  <Thumbnail url={posterUrl(asset) ?? assetUrl(asset.id)} className={FIELD_THUMBNAIL} />
)
