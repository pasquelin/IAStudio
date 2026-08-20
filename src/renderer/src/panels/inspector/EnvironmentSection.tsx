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
 * of any node, which is why it shows whether or not something is selected.
 *
 * Nothing chosen means the procedural studio: a preview is lit before anyone has generated a sky.
 *
 * The Textures space alone since the Environment panel landed. The 3D space asks a wider question
 * — an intensity and an orientation come with the sky there — and answers it in
 * `EnvironmentPanel/EnvironmentLightingSection`, against a `SceneWorld` this shape has no room
 * for. The two share the slot, the asset list and the wording, and nothing else.
 */
export const EnvironmentSection = memo(function EnvironmentSection({
  environment,
  onChange,
}: EnvironmentSectionProps) {
  const { t } = useTranslation()
  const options = useProjectPictures(SKIES)

  return (
    <PropertySection title={t('inspector.environment')} scId="environment">
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
