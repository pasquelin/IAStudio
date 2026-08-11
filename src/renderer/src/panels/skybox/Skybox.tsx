import { mdiWeatherPartlyCloudy } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { AdjustmentStack } from '@shared/domain/adjustments'
import { POLE_LIMIT } from '@shared/domain/angles'
import type { SkyboxEnvironment, SunSettings } from '@shared/domain/skybox'
import { PANEL_SCROLL } from '@/design/styles'
import { ColorField } from '@/design/ColorField'
import { EmptyState } from '@/design/EmptyState'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { TextField } from '@/design/TextField'
import { ToggleField } from '@/design/ToggleField'
import { setAdjustment, setEnvironmentSetting, setSunSetting } from '@/engines/skybox/commands'
import { AdjustmentSliders } from './AdjustmentSliders'
import { activeSkyboxId, useDocuments } from '@/stores/documents'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'

const TWO_PI = Math.PI * 2

/**
 * The right-hand panel of the Skyboxes workspace: the sun, the grading, the environment and
 * what produced the picture. Every control is a uniform — nothing here rewrites a pixel.
 */
export function Skybox() {
  const { t } = useTranslation()

  // The sky in front, and only if it is one: the panel belongs to a workspace, but the
  // document in the centre may be of another kind, and grading a sequence means nothing.
  const documentId = useDocuments(activeSkyboxId)
  const content = useSkyboxes(state => (documentId ? skyboxOf(state, documentId) : null))

  // `!content` cannot happen — `skyboxOf` falls back to the default — but the selector answers
  // `null` for the no-tab case rather than invent an id for it, and this narrows it back.
  if (!documentId || !content) {
    return <EmptyState icon={mdiWeatherPartlyCloudy} message={t('skybox.empty')} />
  }

  const beginGesture = () => useSkyboxes.getState().beginGesture(documentId)
  const endGesture = () => useSkyboxes.getState().endGesture(documentId)

  const onSun = <K extends keyof SunSettings>(key: K, value: SunSettings[K]): void =>
    useSkyboxes.getState().runCommand(documentId, setSunSetting(key, value))

  const onEnvironment = <K extends keyof SkyboxEnvironment>(
    key: K,
    value: SkyboxEnvironment[K],
  ): void => useSkyboxes.getState().runCommand(documentId, setEnvironmentSetting(key, value))

  const onAdjust = (key: keyof AdjustmentStack, value: number): void =>
    useSkyboxes.getState().runCommand(documentId, setAdjustment(key, value))

  return (
    <div className={PANEL_SCROLL}>
      <PropertySection title={t('skybox.sun')}>
        <SliderField
          label={t('skybox.elevation')}
          value={content.sun.elevation}
          min={-POLE_LIMIT}
          max={POLE_LIMIT}
          step={0.01}
          onChange={value => onSun('elevation', value)}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <SliderField
          label={t('skybox.azimuth')}
          value={content.sun.azimuth}
          min={0}
          max={TWO_PI}
          step={0.01}
          onChange={value => onSun('azimuth', value)}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <SliderField
          label={t('skybox.intensity')}
          value={content.sun.intensity}
          min={0}
          max={10}
          step={0.05}
          onChange={value => onSun('intensity', value)}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <ColorField
          label={t('skybox.color')}
          value={content.sun.color}
          onChange={value => onSun('color', value)}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
      </PropertySection>

      <PropertySection title={t('skybox.adjustments')}>
        <AdjustmentSliders
          adjustments={content.adjustments}
          onChange={onAdjust}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
      </PropertySection>

      <PropertySection title={t('skybox.environment')}>
        <SliderField
          label={t('skybox.envIntensity')}
          value={content.environment.intensity}
          min={0}
          max={4}
          step={0.05}
          onChange={value => onEnvironment('intensity', value)}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <ToggleField
          label={t('skybox.showBackground')}
          value={content.environment.showBackground}
          onChange={value => onEnvironment('showBackground', value)}
        />
      </PropertySection>

      {/* Read-only: what produced this sky, so a result can be traced back and reproduced. */}
      <PropertySection title={t('skybox.generation')} defaultOpen={false}>
        <TextField
          label={t('skybox.model')}
          value={content.generation?.modelLabel ?? ''}
          onChange={() => undefined}
        />
        <TextField
          label={t('skybox.prompt')}
          value={content.generation?.prompt ?? ''}
          onChange={() => undefined}
        />
        <TextField
          label={t('skybox.seed')}
          value={content.generation?.seed?.toString() ?? ''}
          onChange={() => undefined}
        />
      </PropertySection>
    </div>
  )
}
