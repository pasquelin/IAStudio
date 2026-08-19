import { useTranslation } from 'react-i18next'
import type { AdjustmentStack } from '@shared/domain/adjustments'
import { POLE_LIMIT } from '@shared/domain/angles'
import type { SkyboxEnvironment, SunSettings } from '@shared/domain/skybox'
import { ColorField } from '@/design/ColorField'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import { setAdjustment, setEnvironmentSetting, setSunSetting } from '@/engines/skybox/commands'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { SkyboxInspectorAdjustments } from './SkyboxInspectorAdjustments'

const TWO_PI = Math.PI * 2

export type SkyboxInspectorProps = { documentId: string }

/**
 * The sky in front: its sun, its grading, what it lights, and what produced it. Every control is
 * a uniform — nothing here rewrites a pixel.
 *
 * A FACE of the inspector rather than a panel of its own, since 2026-08-19. It was the sixth
 * inspector `Inspector` exists not to have: the Skyboxes workspace showed this panel full of the
 * document's properties with the inspector empty underneath it, saying "select something".
 */
export function SkyboxInspector({ documentId }: SkyboxInspectorProps) {
  const { t } = useTranslation()
  const content = useSkyboxes(state => skyboxOf(state, documentId))
  // The same seam every other face uses, rather than three `getState()` closures and a pair of
  // gesture arrows written out — which is what this file carried over from the panel it was.
  const edit = useDocumentEdit(useSkyboxes, documentId)

  const onSun = <K extends keyof SunSettings>(key: K, value: SunSettings[K]): void =>
    edit.run(setSunSetting(key, value))

  const onEnvironment = <K extends keyof SkyboxEnvironment>(
    key: K,
    value: SkyboxEnvironment[K],
  ): void => edit.run(setEnvironmentSetting(key, value))

  const onAdjust = (key: keyof AdjustmentStack, value: number): void =>
    edit.run(setAdjustment(key, value))

  return (
    <>
      <PropertySection title={t('skybox.sun')}>
        <SliderField
          label={t('skybox.elevation')}
          value={content.sun.elevation}
          min={-POLE_LIMIT}
          max={POLE_LIMIT}
          step={0.01}
          onChange={value => onSun('elevation', value)}
          {...edit.gesture}
        />
        <SliderField
          label={t('skybox.azimuth')}
          value={content.sun.azimuth}
          min={0}
          max={TWO_PI}
          step={0.01}
          onChange={value => onSun('azimuth', value)}
          {...edit.gesture}
        />
        <SliderField
          label={t('skybox.intensity')}
          value={content.sun.intensity}
          min={0}
          max={10}
          step={0.05}
          onChange={value => onSun('intensity', value)}
          {...edit.gesture}
        />
        <ColorField
          label={t('skybox.color')}
          value={content.sun.color}
          onChange={value => onSun('color', value)}
          {...edit.gesture}
        />
      </PropertySection>

      <PropertySection title={t('skybox.adjustments')}>
        <SkyboxInspectorAdjustments
          adjustments={content.adjustments}
          onChange={onAdjust}
          {...edit.gesture}
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
          {...edit.gesture}
        />
        <ToggleField
          label={t('skybox.showBackground')}
          value={content.environment.showBackground}
          onChange={value => onEnvironment('showBackground', value)}
        />
      </PropertySection>

      {/* Read out, not typed into. These were `TextField`s whose `onChange` did nothing: three
          boxes that looked editable, took a caret, and dropped every keystroke. */}
      <PropertySection title={t('skybox.generation')} defaultOpen={false}>
        <PropertyRow label={t('skybox.model')}>{content.generation?.modelLabel ?? ''}</PropertyRow>
        <PropertyRow label={t('skybox.prompt')} shape="wrap">
          {content.generation?.prompt ?? ''}
        </PropertyRow>
        <PropertyRow label={t('skybox.seed')}>{content.generation?.seed ?? ''}</PropertyRow>
      </PropertySection>
    </>
  )
}
