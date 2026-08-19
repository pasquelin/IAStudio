import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetType } from '@shared/domain/asset'
import { STUDIO_ENVIRONMENT, type EnvironmentRef } from '@shared/domain/scene'
import { LinkField } from '@/design/LinkField/LinkField'
import { PropertySection } from '@/design/PropertySection'
import { openAssetById } from '@/helpers/openAsset'
import { useProjectPictures } from '@/hooks/useProjectPictures'

const SKIES: readonly AssetType[] = ['skybox']

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
export const EnvironmentSection = memo(function EnvironmentSection({
  environment,
  onChange,
}: EnvironmentSectionProps) {
  const { t } = useTranslation()
  const options = useProjectPictures(SKIES)

  return (
    <PropertySection title={t('inspector.environment')}>
      <LinkField
        label={t('inspector.sky')}
        value={environment.kind === 'skybox' ? environment.assetId : null}
        options={options}
        onChange={assetId => onChange(assetId ? { kind: 'skybox', assetId } : STUDIO_ENVIRONMENT)}
        emptyLabel={t('inspector.studio')}
        missingLabel={t('inspector.missingSky')}
        clearLabel={t('inspector.clearSky')}
        // A sky and nothing else: the slot lights up for what it can actually hold, so a drag
        // across the panel says where it may land before the hand commits to it.
        accepts={SKIES}
        open={{
          label: t('inspector.openSky'),
          hint: t('inspector.openSkyHint'),
          run: () => openAssetById(environment.kind === 'skybox' ? environment.assetId : null),
        }}
        scId="scene.environment"
      />
    </PropertySection>
  )
})
