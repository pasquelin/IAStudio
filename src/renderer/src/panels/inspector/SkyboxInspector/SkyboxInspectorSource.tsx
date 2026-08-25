import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { PICTURES } from '@shared/domain/asset'
import { PropertySection } from '@/design/PropertySection'
import { editPixelsOf } from '@/helpers/openAsset'
import { useProjectPictureAssets } from '@/hooks/useProjectPictureAssets'
import { setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { PictureField } from '../PictureField'

export type SkyboxInspectorSourceProps = { documentId: string }

/**
 * The panorama this sky is made of — the one thing the space had no line for, and so the one
 * picture of the studio nothing but the shelf's context menu could repaint.
 *
 * `memo` for the reason `ChannelsSection` gives: the inspector re-renders on every frame a slider
 * drag emits, and this subtree lists every picture the project holds.
 */
export const SkyboxInspectorSource = memo(function SkyboxInspectorSource({
  documentId,
}: SkyboxInspectorSourceProps) {
  const { t } = useTranslation()
  const source = useSkyboxes(state => skyboxOf(state, documentId).source)
  // Held as ASSETS: the store reads the provenance off the asset, and an id answers nothing.
  const pictures = useProjectPictureAssets(PICTURES)

  // `null` is the empty entry, which a sky HAS — its space draws one, and the row has to reach it.
  const place = (assetId: string | null): void =>
    setSkyboxSource(documentId, pictures.find(candidate => candidate.id === assetId) ?? null)

  const pixels = editPixelsOf(pictures.find(candidate => candidate.id === source?.assetId))

  return (
    <PropertySection title={t('skybox.source')} scId="skybox.source">
      <PictureField
        label={t('skybox.panorama')}
        value={source?.assetId ?? null}
        onChange={place}
        onDropAsset={asset => setSkyboxSource(documentId, asset)}
        open={
          pixels
            ? { label: t('assets.editPixels'), hint: t('assets.editPixelsHint'), run: pixels.run }
            : null
        }
        scId="skybox.source"
      />
    </PropertySection>
  )
})
