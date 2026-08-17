import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, posterUrl, type Asset } from '@shared/domain/asset'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { openAsset } from '@/helpers/open-asset'
import { TIP_LEFT } from '@/helpers/tooltip'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { Row } from '@/design/Row'
import { FIELD_THUMBNAIL, OVERLAY_BUTTON, rowSkin } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import {
  hasChannel,
  openModelMaterial,
  type ChannelTexture,
} from '@/spaces/textures/open-model-material'

import { useDerivedTextures } from '@/hooks/useDerivedTextures'

export type ModelTexturesSectionProps = {
  /** The model's own asset — what the pictures on show were taken out of. */
  assetId: string
  /** The node's name, which is what the material assembled from those pictures is called. */
  name: string
}

/**
 * The pictures an imported model carries, as the ONE material they make up.
 *
 * What one comes to this panel to LOOK at: a model selected in the viewport shows the material
 * its file holds, and a double-click walks to the space that edits it. Where a map is swapped for
 * a picture of the project is a rarer errand, and reads as one — `ModelOverridesSection`, folded,
 * underneath.
 */
export function ModelTexturesSection({ assetId, name }: ModelTexturesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.modelTextures')}>
      {/* Inside the section rather than around it: what is folded away is unmounted, so folding
          this one stops asking the catalogue as well as stops drawing it. */}
      <ModelTextureList assetId={assetId} name={name} empty={t('inspector.noModelTexture')} />
    </PropertySection>
  )
}

/**
 * One pass over the same list, held across renders: `MaterialRow` is memoised and takes
 * `channels` as a prop, so a fresh array each render would defeat the barrier. What
 * `useDerivedTextures` hands back keeps its identity while the catalogue answers the same rows.
 *
 * The empty note arrives already translated so that this component takes no subscription of its
 * own: `useTranslation` re-subscribes to i18next on every render, and the inspector renders on
 * every frame of a gizmo drag. It saves the SECOND subscription, not the first — the section
 * above still holds one for its own title.
 */
function ModelTextureList({ assetId, name, empty }: ModelTexturesSectionProps & { empty: string }) {
  const textures = useDerivedTextures(assetId)
  const { channels, packed } = useMemo(() => split(textures), [textures])

  // Said rather than left blank: extraction runs at import with nobody waiting on it, so an empty
  // list is as often "not yet" as "this file carries none".
  if (textures.length === 0) return <QuietNote>{empty}</QuietNote>

  return (
    // Two, like every other stack of this panel — `PROPERTY_BODY` spaces the sections' children
    // by two and these rows are one of them. Flush, they read as one block rather than as a list;
    // by one, `spacing.test.ts` refuses them, and it is right to: the studio has one gap.
    <div className="flex flex-col gap-2">
      {channels.length > 0 && <MaterialRow assetId={assetId} name={name} channels={channels} />}
      {packed.map(texture => (
        <PackedRow key={texture.id} texture={texture} />
      ))}
    </div>
  )
}

function split(textures: readonly Asset[]): {
  channels: ChannelTexture[]
  packed: Asset[]
} {
  const channels: ChannelTexture[] = []
  const packed: Asset[] = []
  for (const texture of textures) {
    if (hasChannel(texture)) channels.push(texture)
    else packed.push(texture)
  }
  return { channels, packed }
}

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
function ModelRow({
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
const pictureOf = (asset: Asset): ReactNode => (
  <Thumbnail url={posterUrl(asset) ?? assetUrl(asset.id)} className={FIELD_THUMBNAIL} />
)

/**
 * A model's maps, as the single material they are.
 *
 * One line and not one per picture, because a texture document of this studio IS a material — a
 * set of channels with its own settings. Three lines for a base colour, a normal and an occlusion
 * described three files where the user sees one surface, and left the assembling to be done by
 * hand, slot by slot, in the other space.
 *
 * Memoised because the inspector re-renders on every frame of a gizmo drag (`SceneInspector` says
 * so at its own line), and a list of rows has no business in that budget.
 */
const MaterialRow = memo(function MaterialRow({
  assetId,
  name,
  channels,
}: ModelTexturesSectionProps & { channels: readonly ChannelTexture[] }) {
  const { t } = useTranslation()
  const cover = channels.find(texture => texture.map === 'baseColor') ?? channels[0]

  return (
    <ModelRow
      media={cover ? pictureOf(cover) : <Thumbnail className={FIELD_THUMBNAIL} />}
      title={t('inspector.modelMaterial')}
      // What KIND of thing this is, which is what the second line of a row says everywhere else —
      // and for a material the kind IS the set of channels it holds.
      subtitle={channels.map(texture => t(`texture.channel.${texture.map}`)).join(', ')}
      label={t('inspector.openMaterial')}
      hint={t('inspector.openMaterialHint')}
      onOpen={() => void openModelMaterial({ id: assetId, name }, channels)}
    />
  )
})

/**
 * One picture the material could not take, and why it could not.
 *
 * Three files come out of an import with no channel claimed, and for two different reasons: a
 * `metallicRoughnessTexture` packs two of the studio's channels into one image and an ORM export
 * three, while a `clearcoatTexture` names something the studio has no channel for at all
 * (`glb-textures.ts` says both at its own line). WHICH of the two the catalogue cannot say — the
 * glTF slot survives only inside the asset's name — so the sentence says the one thing true of
 * every case: this image is not one channel. Blank underneath, the row read as an oversight.
 */
const PackedRow = memo(function PackedRow({ texture }: { texture: Asset }) {
  const { t } = useTranslation()

  return (
    <ModelRow
      media={pictureOf(texture)}
      // The name over the kind: what the thing IS on the first line, what KIND of thing on the
      // second. One list reading the other way round was one list to learn twice.
      title={texture.name}
      subtitle={t('inspector.unclaimedChannel')}
      label={t('home.open', { name: texture.name })}
      hint={t('inspector.openTextureHint')}
      onOpen={() => void openAsset(texture)}
    />
  )
})
