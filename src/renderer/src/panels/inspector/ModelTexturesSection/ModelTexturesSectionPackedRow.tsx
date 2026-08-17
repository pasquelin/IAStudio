import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { openAsset } from '@/helpers/openAsset'
import { ModelTexturesSectionRow, pictureOf } from './ModelTexturesSectionRow'

/**
 * One picture the material could not take, and why it could not.
 *
 * Three files come out of an import with no channel claimed, and for two different reasons: a
 * `metallicRoughnessTexture` packs two of the studio's channels into one image and an ORM export
 * three, while a `clearcoatTexture` names something the studio has no channel for at all
 * (`glbTextures.ts` says both at its own line). WHICH of the two the catalogue cannot say — the
 * glTF slot survives only inside the asset's name — so the sentence says the one thing true of
 * every case: this image is not one channel. Blank underneath, the row read as an oversight.
 */
export const ModelTexturesSectionPackedRow = memo(function ModelTexturesSectionPackedRow({
  texture,
}: {
  texture: Asset
}) {
  const { t } = useTranslation()

  return (
    <ModelTexturesSectionRow
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
