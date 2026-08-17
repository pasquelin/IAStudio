import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FIELD_THUMBNAIL } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'
import { openModelMaterial, type ChannelTexture } from '@/spaces/textures/open-model-material'
import { ModelTexturesSectionRow, pictureOf } from './ModelTexturesSectionRow'

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
export const ModelTexturesSectionMaterialRow = memo(function ModelTexturesSectionMaterialRow({
  assetId,
  name,
  channels,
}: {
  assetId: string
  name: string
  channels: readonly ChannelTexture[]
}) {
  const { t } = useTranslation()
  const cover = channels.find(texture => texture.map === 'baseColor') ?? channels[0]

  return (
    <ModelTexturesSectionRow
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
