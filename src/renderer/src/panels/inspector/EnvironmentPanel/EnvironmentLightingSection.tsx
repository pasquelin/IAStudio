import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetType } from '@shared/domain/asset'
import { toDegrees, toRadians } from '@shared/domain/angles'
import {
  ENV_INTENSITY,
  ENVIRONMENT_KINDS,
  STUDIO_ENVIRONMENT,
  type SceneWorld,
} from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { SliderField } from '@/design/SliderField'
import { LinkField } from '@/design/LinkField/LinkField'
import type { GestureProps } from '@/design/styles'
import { environmentOfKind } from '@/engines/scene/sceneWorld'
import { openAssetById } from '@/helpers/openAsset'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useProjectPictures } from '@/hooks/useProjectPictures'
import { choicesOf } from './environmentChoices'

const SKIES: readonly AssetType[] = ['skybox']

export type EnvironmentLightingSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  gesture: GestureProps
}

/**
 * What lights the subject and what its materials reflect. A scene is lit by exactly ONE
 * prefiltered map, so the studio and a sky are alternatives rather than layers — hence the first
 * row. The intensity multiplies whichever is in hand; see `applyWorld`, which holds that half.
 */
export function EnvironmentLightingSection({
  world,
  onChange,
  gesture,
}: EnvironmentLightingSectionProps) {
  const { t } = useTranslation()
  const skies = useProjectPictures(SKIES)
  const sources = useMemo(() => choicesOf(ENVIRONMENT_KINDS, 'environment.source_', t), [t])
  const environment = world.environment
  const skyId = environment.kind === 'skybox' ? environment.assetId : null

  return (
    <PropertySection title={t('environment.ambience')} scId="lighting">
      <SelectField
        label={t('environment.source')}
        scId="environment.source"
        value={environment.kind}
        options={sources.options}
        onChange={kind => onChange({ environment: environmentOfKind(kind, skies) })}
        hint={HINT_LEFT(sources.hintOf(environment.kind))}
      />

      {/* Shown whatever the source, and NOT only under « sky »: this slot is the one drop target
          the 3D space has for a sky, and a fresh scene opens on the studio — hiding it there left
          no way at all to drag one in. */}
      <LinkField
        label={t('inspector.sky')}
        value={skyId}
        options={skies}
        onChange={assetId =>
          onChange({ environment: assetId ? { kind: 'skybox', assetId } : STUDIO_ENVIRONMENT })
        }
        emptyLabel={t('inspector.studio')}
        missingLabel={t('inspector.missingSky')}
        clearLabel={t('inspector.clearSky')}
        clearHint={t('inspector.clearSkyHint')}
        // A sky and nothing else: the slot lights up for what it can actually hold, so a drag
        // across the panel says where it may land before the hand commits to it.
        accepts={SKIES}
        open={{
          label: t('inspector.openSky'),
          hint: t('inspector.openSkyHint'),
          run: () => openAssetById(skyId),
        }}
        scId="scene.environment"
      />

      <SliderField
        label={t('environment.intensity')}
        scId="environment.intensity"
        value={world.envIntensity}
        min={ENV_INTENSITY.min}
        max={ENV_INTENSITY.max}
        step={ENV_INTENSITY.step}
        onChange={envIntensity => onChange({ envIntensity })}
        {...gesture}
      />

      {/* Turning a procedural room shows nothing: there is no horizon in it to move. */}
      {environment.kind === 'skybox' && (
        <SliderField
          label={t('environment.rotation')}
          scId="environment.rotation"
          // Degrees on screen, radians in the document — the rule every other angle follows.
          value={Math.round(toDegrees(world.envRotation))}
          min={0}
          max={360}
          step={1}
          onChange={degrees => onChange({ envRotation: toRadians(degrees) })}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
