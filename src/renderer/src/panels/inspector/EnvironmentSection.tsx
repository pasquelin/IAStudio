import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, isLocalPicture } from '@shared/domain/asset'
import { STUDIO_ENVIRONMENT, type EnvironmentRef } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { setEnvironment } from '@/engines/scene/commands'
import { useAssets } from '@/stores/assets'
import type { SceneEdit } from './useSceneEdit'

export type EnvironmentSectionProps = { environment: EnvironmentRef; edit: SceneEdit }

/**
 * What lights the scene, and what its materials reflect. A property of the document rather than
 * of any node, which is why it shows whether or not something is selected — and why the panel is
 * no longer empty when nothing is.
 *
 * Nothing chosen means the procedural studio: a scene is lit before anyone has generated a sky.
 */
export function EnvironmentSection({ environment, edit }: EnvironmentSectionProps) {
  const { t } = useTranslation()
  const assets = useAssets(state => state.items)

  const options = useMemo<TextureOption[]>(
    () =>
      assets
        // `isLocalPicture` and nothing else: a cloud row would be offered, chosen, and show
        // nothing at all — the same question has to have one answer everywhere.
        .filter(asset => asset.type === 'skybox' && isLocalPicture(asset))
        .map(asset => ({ id: asset.id, name: asset.name, url: assetUrl(asset.id) })),
    [assets],
  )

  return (
    <PropertySection title={t('inspector.environment')}>
      <TextureField
        label={t('inspector.sky')}
        value={environment.kind === 'skybox' ? environment.assetId : null}
        options={options}
        onChange={assetId =>
          edit.run(setEnvironment(assetId ? { kind: 'skybox', assetId } : STUDIO_ENVIRONMENT))
        }
        emptyLabel={t('inspector.studio')}
        chooseLabel={t('inspector.chooseSky')}
        clearLabel={t('inspector.clearSky')}
      />
    </PropertySection>
  )
}
