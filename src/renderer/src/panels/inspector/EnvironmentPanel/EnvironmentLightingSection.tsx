import { useTranslation } from 'react-i18next'
import type { AssetType } from '@shared/domain/asset'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { ENV_INTENSITY, STUDIO_ENVIRONMENT, type SceneWorld } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { LinkField } from '@/design/LinkField/LinkField'
import type { GestureProps } from '@/design/styles'
import { openAssetById } from '@/helpers/openAsset'
import { useProjectPictures } from '@/hooks/useProjectPictures'

const SKIES: readonly AssetType[] = ['skybox']

export type EnvironmentLightingSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  gesture: GestureProps
}

/**
 * What lights the subject and what its materials reflect. The intensity is a MULTIPLIER over the
 * studio's own strength, not an absolute: at 1 a saved scene is lit exactly as before. See
 * `applyWorld`, which holds the other half.
 */
export function EnvironmentLightingSection({
  world,
  onChange,
  gesture,
}: EnvironmentLightingSectionProps) {
  const { t } = useTranslation()
  const options = useProjectPictures(SKIES)

  return (
    <PropertySection title={t('environment.lighting')} scId="lighting">
      <LinkField
        label={t('inspector.sky')}
        value={world.environment.kind === 'skybox' ? world.environment.assetId : null}
        options={options}
        onChange={assetId =>
          onChange({ environment: assetId ? { kind: 'skybox', assetId } : STUDIO_ENVIRONMENT })
        }
        emptyLabel={t('inspector.studio')}
        missingLabel={t('inspector.missingSky')}
        clearLabel={t('inspector.clearSky')}
        // A sky and nothing else: the slot lights up for what it can actually hold, so a drag
        // across the panel says where it may land before the hand commits to it.
        accepts={SKIES}
        open={{
          label: t('inspector.openSky'),
          hint: t('inspector.openSkyHint'),
          run: () =>
            openAssetById(world.environment.kind === 'skybox' ? world.environment.assetId : null),
        }}
        scId="scene.environment"
      />

      <SliderField
        label={t('environment.intensity')}
        value={world.envIntensity}
        min={ENV_INTENSITY.min}
        max={ENV_INTENSITY.max}
        step={ENV_INTENSITY.step}
        onChange={envIntensity => onChange({ envIntensity })}
        {...gesture}
      />

      <SliderField
        label={t('environment.rotation')}
        // Degrees on screen, radians in the document — the rule every other angle of the studio
        // follows, and the one place the two meet.
        value={Math.round(toDegrees(world.envRotation))}
        min={0}
        max={360}
        step={1}
        onChange={degrees => onChange({ envRotation: toRadians(degrees) })}
        {...gesture}
      />
    </PropertySection>
  )
}
