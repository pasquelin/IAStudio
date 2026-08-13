import { mdiTextureBox } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, posterUrl, type Asset } from '@shared/domain/asset'
import { openAsset } from '@/helpers/open-asset'
import { TIP_LEFT } from '@/helpers/tooltip'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { ShelfTile } from '@/design/ShelfTile'

import { useDerivedTextures } from './useDerivedTextures'

export type ModelTexturesSectionProps = {
  /** The model's own asset — what the pictures on show were taken out of. */
  assetId: string
}

/**
 * The pictures an imported model carries, laid out as they are on the shelf.
 *
 * What one comes to this panel to LOOK at: a model selected in the viewport shows its own maps,
 * and a double-click walks to the space that edits them. Where a map is swapped for a picture of
 * the project is a rarer errand, and reads as one — `ModelOverridesSection`, folded, underneath.
 */
export function ModelTexturesSection({ assetId }: ModelTexturesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.modelTextures')}>
      {/* Inside the section rather than around it: what is folded away is unmounted, so folding
          this one stops asking the catalogue as well as stops drawing it. */}
      <ModelTextureGrid assetId={assetId} />
    </PropertySection>
  )
}

function ModelTextureGrid({ assetId }: { assetId: string }) {
  const { t } = useTranslation()
  const textures = useDerivedTextures(assetId)

  // Said rather than left blank: extraction runs at import with nobody waiting on it, so an empty
  // grid is as often "not yet" as "this file carries none".
  if (textures.length === 0) return <QuietNote>{t('inspector.noModelTexture')}</QuietNote>

  return (
    <div className="grid grid-cols-2 gap-2">
      {textures.map(texture => (
        <ModelTextureTile key={texture.id} texture={texture} />
      ))}
    </div>
  )
}

/**
 * One picture of the model, captioned by the channel it plays and opened where it is edited.
 *
 * Memoised because the inspector re-renders on every frame of a gizmo drag (`SceneInspector`
 * says so at its own line), and a row of tiles has no business in that budget.
 */
const ModelTextureTile = memo(function ModelTextureTile({ texture }: { texture: Asset }) {
  const { t } = useTranslation()
  // The channel over the file name: seven pictures called « Robot — … » differ by that word alone.
  // A slot the studio has no channel for keeps the name the extraction gave it.
  const caption = texture.map ? t(`texture.channel.${texture.map}`) : texture.name

  return (
    <ShelfTile
      // Straight off the row this grid was answered with, rather than through `usePosterUrl`:
      // the asset is in hand, and it is fresher than the shelf, which is scoped by space.
      url={posterUrl(texture) ?? assetUrl(texture.id)}
      caption={caption}
      fallbackIcon={mdiTextureBox}
      label={t('home.open', { name: caption })}
      hint={t('inspector.openTextureHint')}
      tip={TIP_LEFT}
      onActivate={() => void openAsset(texture)}
    />
  )
})
