import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { EnvironmentRef } from '@shared/domain/scene'
import { ColorField } from '@/design/ColorField'
import { PropertySection } from '@/design/PropertySection'
import { RangeField } from '@/design/RangeField'
import { SelectField } from '@/design/SelectField'
import { SliderField } from '@/design/SliderField'
import { HINT_LEFT } from '@/helpers/tooltip'
import { ToggleField } from '@/design/ToggleField'
import { VectorField } from '@/design/VectorField'
import { setMaterialSetting, setPreview } from '@/engines/material/commands'
import {
  DEFAULT_PREVIEW,
  PREVIEW_BOUNDS,
  PREVIEW_SHAPES,
  TILING_PREVIEWS,
} from '@/engines/material/materialState'
import { SHAPE_LABELS } from '@/spaces/materials/materialTools'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { DEFAULT_TEXTURE_MATERIAL, MATERIAL_BOUNDS } from '@shared/domain/material'
import { materialOf, useMaterials } from '@/stores/materials'
import { EnvironmentSection } from '../EnvironmentSection'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'
import { ChannelsSection } from '../ChannelsSection/ChannelsSection'
import { StylesSection } from '../StylesSection/StylesSection'
import { MaterialInspectorSeamReading } from './MaterialInspectorSeamReading'

export type TextureInspectorProps = { documentId: string }

/**
 * Everything a material is made of, and everything the shape it sits on is judged under.
 *
 * A face of the one inspector rather than a panel of its own — the studio has a single answer to
 * "what am I looking at". It reads the document in front, so nothing here has to be selected.
 *
 * Roughness, not glossiness: the file stores roughness, three calls it roughness, and the 3D
 * inspector already says roughness. One word for one quantity, with the tooltip carrying the
 * reading for whoever arrives from Substance.
 */
export function MaterialInspector({ documentId }: TextureInspectorProps) {
  const { t } = useTranslation()
  const material = useMaterials(state => materialOf(state, documentId).material)
  const preview = useMaterials(state => materialOf(state, documentId).preview)
  const edit = useDocumentEdit(useMaterials, documentId)

  const onMaterial = <K extends keyof typeof material>(key: K, value: (typeof material)[K]): void =>
    edit.run(setMaterialSetting(key, value))
  const onPreview = <K extends keyof typeof preview>(key: K, value: (typeof preview)[K]): void =>
    edit.run(setPreview(key, value))

  // Through the same setter, so ⌘Z takes a reset back the way it takes a drag back.
  const resetMaterial = <K extends keyof typeof material>(key: K): (() => void) | undefined =>
    material[key] === DEFAULT_TEXTURE_MATERIAL[key]
      ? undefined
      : () => onMaterial(key, DEFAULT_TEXTURE_MATERIAL[key])

  const resetPreview = <K extends keyof typeof preview>(key: K): (() => void) | undefined =>
    preview[key] === DEFAULT_PREVIEW[key] ? undefined : () => onPreview(key, DEFAULT_PREVIEW[key])

  /**
   * Stable, so the memo on `EnvironmentSection` can actually skip: a fresh arrow at the call site
   * made it re-render on every value a slider drag emits, in the one panel that drags the most.
   * It captures `edit` alone, itself memoised on the document.
   */
  const changeEnvironment = useCallback(
    (next: EnvironmentRef) => edit.run(setPreview('environment', next)),
    [edit],
  )

  return (
    <>
      {/* Keyed: the derivation in flight is that section's own state, and one instance shared
          across documents left every derivable row of the texture in front dead for a job running
          in another tab. */}
      <ChannelsSection key={documentId} documentId={documentId} />

      {/* Beside the channels they read, and before the values they write: a style is picked, then
          tuned by the sections underneath. */}
      <StylesSection documentId={documentId} />

      <PropertySection title={t('inspector.material')} scId="material.material">
        <ColorField
          label={t('material.baseTint')}
          scId="material.baseTint"
          value={material.color}
          onChange={value => onMaterial('color', value)}
          {...edit.gesture}
        />

        <SliderField
          label={t('material.roughness')}
          scId="material.roughness"
          value={material.roughness}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('roughness', value)}
          onReset={resetMaterial('roughness')}
          {...edit.gesture}
        />
        {/* The remap reads the map, so it is offered next to the scalar that multiplies it: a
            generated channel is usually flat, and this is what gives it a range to live in. */}
        <RangeField
          label={t('material.roughnessRange')}
          value={material.roughnessRange}
          min={0}
          max={1}
          step={0.01}
          fromLabel={t('material.roughnessFrom')}
          toLabel={t('material.roughnessTo')}
          scId="material.roughnessRange"
          onChange={value => onMaterial('roughnessRange', value)}
          {...edit.gesture}
        />

        <SliderField
          label={t('material.metalness')}
          scId="material.metalness"
          value={material.metalness}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('metalness', value)}
          onReset={resetMaterial('metalness')}
          {...edit.gesture}
        />
        <RangeField
          label={t('material.metalnessRange')}
          value={material.metalnessRange}
          min={0}
          max={1}
          step={0.01}
          fromLabel={t('material.metalnessFrom')}
          toLabel={t('material.metalnessTo')}
          scId="material.metalnessRange"
          onChange={value => onMaterial('metalnessRange', value)}
          {...edit.gesture}
        />

        <SliderField
          label={t('material.aoIntensity')}
          scId="material.aoIntensity"
          value={material.aoIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('aoIntensity', value)}
          onReset={resetMaterial('aoIntensity')}
          {...edit.gesture}
        />
        <SliderField
          label={t('material.edgeIntensity')}
          scId="material.edgeIntensity"
          value={material.edgeIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('edgeIntensity', value)}
          onReset={resetMaterial('edgeIntensity')}
          {...edit.gesture}
        />
      </PropertySection>

      <PropertySection title={t('material.relief')} scId="material.relief">
        {/* Signed on purpose: a negative scale flips the relief, which is the answer to a normal
            map baked the other way round. */}
        {/* The bounds come from the state, which clamps a hand-edited file to the same ones. */}
        <SliderField
          label={t('material.normalScale')}
          scId="material.normalScale"
          value={material.normalScale}
          {...MATERIAL_BOUNDS.normalScale}
          onChange={value => onMaterial('normalScale', value)}
          onReset={resetMaterial('normalScale')}
          {...edit.gesture}
        />
        <ToggleField
          label={t('material.invertNormalGreen')}
          scId="material.invertNormalGreen"
          value={material.invertNormalGreen}
          onChange={value => onMaterial('invertNormalGreen', value)}
        />
        {/* Off by default, and it says why in the state: a subdivided sphere costs more than the
            scene it previews, so displacement is something asked for rather than assumed. */}
        <SliderField
          label={t('material.heightScale')}
          scId="material.heightScale"
          value={material.heightScale}
          {...MATERIAL_BOUNDS.heightScale}
          onChange={value => onMaterial('heightScale', value)}
          onReset={resetMaterial('heightScale')}
          {...edit.gesture}
        />
      </PropertySection>

      <PropertySection title={t('material.emission')} scId="material.emission">
        <ColorField
          label={t('material.emissive')}
          scId="material.emissive"
          value={material.emissive}
          onChange={value => onMaterial('emissive', value)}
          {...edit.gesture}
        />
        <SliderField
          label={t('material.emissiveIntensity')}
          scId="material.emissiveIntensity"
          value={material.emissiveIntensity}
          {...MATERIAL_BOUNDS.emissiveIntensity}
          onChange={value => onMaterial('emissiveIntensity', value)}
          onReset={resetMaterial('emissiveIntensity')}
          {...edit.gesture}
        />
      </PropertySection>

      {/* One set of values for all eight channels: applied to one alone, the maps drift apart and
          the relief stops matching the picture it lifts. */}
      <PropertySection title={t('material.tiling')} defaultOpen={false} scId="material.tiling">
        <VectorField
          label={t('material.repeat')}
          scId="material.repeat"
          value={material.tiling}
          {...MATERIAL_BOUNDS.tiling}
          onChange={value => onMaterial('tiling', value)}
          {...edit.gesture}
        />
        <VectorField
          label={t('material.offset')}
          scId="material.offset"
          value={material.offset}
          step={0.01}
          onChange={value => onMaterial('offset', value)}
          {...edit.gesture}
        />
        {/* Degrees on screen, radians in the file — the same trade the sky inspector makes. */}
        <SliderField
          label={t('material.rotation')}
          scId="material.rotation"
          value={toDegrees(material.rotation)}
          min={0}
          max={360}
          step={1}
          onChange={value => onMaterial('rotation', toRadians(value))}
          onReset={resetMaterial('rotation')}
          {...edit.gesture}
        />

        {/* Below the values it multiplies, and visibly apart from them: these two are how the
            repeat is LOOKED at, and neither ever reaches a scene. */}
        <SelectField
          label={t('material.tilingPreview')}
          scId="material.tilingPreview"
          value={String(preview.tilingPreview)}
          options={TILING_PREVIEWS.map(times => ({
            value: String(times),
            label: t('material.tilingPreviewTimes', { count: times }),
          }))}
          // Back to the numeric union — the field speaks strings.
          onChange={value => {
            const times = TILING_PREVIEWS.find(candidate => String(candidate) === value)
            if (times) onPreview('tilingPreview', times)
          }}
          hint={HINT_LEFT(t('material.tilingPreviewHint'))}
        />
        <ToggleField
          label={t('material.showSeam')}
          scId="material.showSeam"
          value={preview.showSeam}
          onChange={value => onPreview('showSeam', value)}
        />
        <MaterialInspectorSeamReading documentId={documentId} />
      </PropertySection>

      <PropertySection title={t('material.preview')} scId="material.preview">
        <SelectField
          label={t('material.previewShape')}
          scId="material.previewShape"
          value={preview.shape}
          options={PREVIEW_SHAPES.map(shape => ({
            value: shape,
            label: t(SHAPE_LABELS[shape]),
          }))}
          onChange={shape => onPreview('shape', shape)}
          hint={HINT_LEFT(t('material.previewShapeHint'))}
        />

        <SliderField
          label={t('material.envIntensity')}
          scId="material.envIntensity"
          value={preview.envIntensity}
          {...PREVIEW_BOUNDS.envIntensity}
          onChange={value => onPreview('envIntensity', value)}
          onReset={resetPreview('envIntensity')}
          {...edit.gesture}
        />
        <SliderField
          label={t('material.envRotation')}
          scId="material.envRotation"
          value={toDegrees(preview.envRotation)}
          min={0}
          max={360}
          step={1}
          onChange={value => onPreview('envRotation', toRadians(value))}
          onReset={resetPreview('envRotation')}
          {...edit.gesture}
        />
        <ToggleField
          label={t('material.showBackground')}
          scId="material.showBackground"
          value={preview.showBackground}
          onChange={value => onPreview('showBackground', value)}
        />
        <ToggleField
          label={t('material.autoSpin')}
          scId="material.autoSpin"
          value={preview.autoSpin}
          onChange={value => onPreview('autoSpin', value)}
        />
      </PropertySection>

      {/* The very section the 3D space shows, because it is the same question: a texture judged
          under a flat lamp is not judged, and the skies on offer are the project's own. */}
      <EnvironmentSection environment={preview.environment} onChange={changeEnvironment} />
    </>
  )
}
