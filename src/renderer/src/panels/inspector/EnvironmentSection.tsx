import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, isLocalPicture } from '@shared/domain/asset'
import { STUDIO_ENVIRONMENT, type EnvironmentRef } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { useAssets } from '@/stores/assets'

export type EnvironmentSectionProps = {
  environment: EnvironmentRef
  /** The command is the caller's: a scene and a texture keep this setting in different places. */
  onChange: (environment: EnvironmentRef) => void
}

/**
 * What lights the subject, and what its materials reflect. A property of the document rather than
 * of any node, which is why it shows whether or not something is selected — and why the panel is
 * no longer empty when nothing is.
 *
 * Nothing chosen means the procedural studio: a scene is lit before anyone has generated a sky.
 *
 * Shared by the 3D space and by Textures, because it is one question with one answer: a roughness
 * judged under a flat lamp is not judged, and the skies on offer are the project's own either way.
 */
export function EnvironmentSection({ environment, onChange }: EnvironmentSectionProps) {
  const { t } = useTranslation()
  const assets = useAssets(state => state.items)

  const options = useMemo<TextureOption[]>(
    () =>
      assets
        // `isLocalPicture` and nothing else: a cloud row would be offered, chosen, and show
        // nothing at all — the same question has to have one answer everywhere.
        .filter(asset => asset.type === 'skybox' && isLocalPicture(asset))
        .map(asset => ({
          id: asset.id,
          name: asset.name,
          url: assetUrl(asset.id, asset.localChangedAt),
        })),
    [assets],
  )

  return (
    <PropertySection title={t('inspector.environment')}>
      <TextureField
        label={t('inspector.sky')}
        value={environment.kind === 'skybox' ? environment.assetId : null}
        options={options}
        onChange={assetId => onChange(assetId ? { kind: 'skybox', assetId } : STUDIO_ENVIRONMENT)}
        emptyLabel={t('inspector.studio')}
        chooseLabel={t('inspector.chooseSky')}
        clearLabel={t('inspector.clearSky')}
        emptyHint={t('inspector.studioHint')}
        optionHint={t('inspector.pickSkyHint')}
      />
    </PropertySection>
  )
}
