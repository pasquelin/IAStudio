import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { Chip } from '@/design/Chip'
import { ColorField } from '@/design/ColorField'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { RangeField } from '@/design/RangeField'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import { VectorField } from '@/design/VectorField'
import { setTextureMaterial, setPreview } from '@/engines/texture/commands'
import {
  PREVIEW_BOUNDS,
  PREVIEW_SHAPES,
  TILING_PREVIEWS,
  type PreviewShape,
} from '@/engines/texture/texture-state'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { MATERIAL_BOUNDS, seamVerdict, type SeamVerdict } from '@shared/domain/texture'
import { textureOf, useTextures } from '@/stores/textures'
import { seamOf, useTextureViews } from '@/stores/texture-views'
import { EnvironmentSection } from './EnvironmentSection'
import { useDocumentEdit } from './useDocumentEdit'
import { HINT_LEFT } from '@/helpers/tooltip'

export type TextureInspectorProps = { documentId: string }

/** i18n key of a verdict — never the label itself, as the shapes below do. */
const SEAM_LABELS: Record<SeamVerdict, string> = {
  none: 'texture.seamNone',
  faint: 'texture.seamFaint',
  visible: 'texture.seamVisible',
}

/** i18n key of a shape — never the label itself, as the scene registry does for its primitives. */
const SHAPE_LABELS: Record<PreviewShape, string> = {
  sphere: 'texture.shapeSphere',
  box: 'texture.shapeBox',
  cylinder: 'texture.shapeCylinder',
  plane: 'texture.shapePlane',
  torusKnot: 'texture.shapeKnot',
}

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
export function TextureInspector({ documentId }: TextureInspectorProps) {
  const { t } = useTranslation()
  const material = useTextures(state => textureOf(state, documentId).material)
  const preview = useTextures(state => textureOf(state, documentId).preview)
  const edit = useDocumentEdit(useTextures, documentId)

  const onMaterial = <K extends keyof typeof material>(key: K, value: (typeof material)[K]): void =>
    edit.run(setTextureMaterial(key, value))
  const onPreview = <K extends keyof typeof preview>(key: K, value: (typeof preview)[K]): void =>
    edit.run(setPreview(key, value))

  return (
    <>
      <PropertySection title={t('inspector.material')}>
        <ColorField
          label={t('texture.baseTint')}
          value={material.color}
          onChange={value => onMaterial('color', value)}
          {...edit.gesture}
        />

        <SliderField
          label={t('texture.roughness')}
          value={material.roughness}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('roughness', value)}
          {...edit.gesture}
        />
        {/* The remap reads the map, so it is offered next to the scalar that multiplies it: a
            generated channel is usually flat, and this is what gives it a range to live in. */}
        <RangeField
          label={t('texture.roughnessRange')}
          value={material.roughnessRange}
          min={0}
          max={1}
          step={0.01}
          fromLabel={t('texture.roughnessFrom')}
          toLabel={t('texture.roughnessTo')}
          onChange={value => onMaterial('roughnessRange', value)}
          {...edit.gesture}
        />

        <SliderField
          label={t('texture.metalness')}
          value={material.metalness}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('metalness', value)}
          {...edit.gesture}
        />
        <RangeField
          label={t('texture.metalnessRange')}
          value={material.metalnessRange}
          min={0}
          max={1}
          step={0.01}
          fromLabel={t('texture.metalnessFrom')}
          toLabel={t('texture.metalnessTo')}
          onChange={value => onMaterial('metalnessRange', value)}
          {...edit.gesture}
        />

        <SliderField
          label={t('texture.aoIntensity')}
          value={material.aoIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('aoIntensity', value)}
          {...edit.gesture}
        />
        <SliderField
          label={t('texture.edgeIntensity')}
          value={material.edgeIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => onMaterial('edgeIntensity', value)}
          {...edit.gesture}
        />
      </PropertySection>

      <PropertySection title={t('texture.relief')}>
        {/* Signed on purpose: a negative scale flips the relief, which is the answer to a normal
            map baked the other way round. */}
        {/* The bounds come from the state, which clamps a hand-edited file to the same ones. */}
        <SliderField
          label={t('texture.normalScale')}
          value={material.normalScale}
          {...MATERIAL_BOUNDS.normalScale}
          onChange={value => onMaterial('normalScale', value)}
          {...edit.gesture}
        />
        <ToggleField
          label={t('texture.invertNormalGreen')}
          value={material.invertNormalGreen}
          onChange={value => onMaterial('invertNormalGreen', value)}
        />
        {/* Off by default, and it says why in the state: a subdivided sphere costs more than the
            scene it previews, so displacement is something asked for rather than assumed. */}
        <SliderField
          label={t('texture.heightScale')}
          value={material.heightScale}
          {...MATERIAL_BOUNDS.heightScale}
          onChange={value => onMaterial('heightScale', value)}
          {...edit.gesture}
        />
      </PropertySection>

      <PropertySection title={t('texture.emission')}>
        <ColorField
          label={t('texture.emissive')}
          value={material.emissive}
          onChange={value => onMaterial('emissive', value)}
          {...edit.gesture}
        />
        <SliderField
          label={t('texture.emissiveIntensity')}
          value={material.emissiveIntensity}
          {...MATERIAL_BOUNDS.emissiveIntensity}
          onChange={value => onMaterial('emissiveIntensity', value)}
          {...edit.gesture}
        />
      </PropertySection>

      {/* One set of values for all eight channels: applied to one alone, the maps drift apart and
          the relief stops matching the picture it lifts. */}
      <PropertySection title={t('texture.tiling')} defaultOpen={false}>
        <VectorField
          label={t('texture.repeat')}
          value={material.tiling}
          {...MATERIAL_BOUNDS.tiling}
          onChange={value => onMaterial('tiling', value)}
          {...edit.gesture}
        />
        <VectorField
          label={t('texture.offset')}
          value={material.offset}
          step={0.01}
          onChange={value => onMaterial('offset', value)}
          {...edit.gesture}
        />
        {/* Degrees on screen, radians in the file — the same trade the sky inspector makes. */}
        <SliderField
          label={t('texture.rotation')}
          value={toDegrees(material.rotation)}
          min={0}
          max={360}
          step={1}
          onChange={value => onMaterial('rotation', toRadians(value))}
          {...edit.gesture}
        />

        {/* Below the values it multiplies, and visibly apart from them: these two are how the
            repeat is LOOKED at, and neither ever reaches a scene. */}
        <PropertyRow label={t('texture.tilingPreview')}>
          <div className="flex justify-end gap-2">
            {TILING_PREVIEWS.map(times => (
              <Chip
                key={times}
                label={t('texture.tilingPreviewTimes', { count: times })}
                hint={t('texture.tilingPreviewHint')}
                selected={preview.tilingPreview === times}
                onClick={() => onPreview('tilingPreview', times)}
              />
            ))}
          </div>
        </PropertyRow>
        <ToggleField
          label={t('texture.showSeam')}
          value={preview.showSeam}
          onChange={value => onPreview('showSeam', value)}
        />
        <SeamReading documentId={documentId} />
      </PropertySection>

      <PropertySection title={t('texture.preview')}>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_SHAPES.map(shape => (
            <Chip
              key={shape}
              label={t(SHAPE_LABELS[shape])}
              hint={t('texture.previewShapeHint')}
              selected={preview.shape === shape}
              onClick={() => onPreview('shape', shape)}
            />
          ))}
        </div>

        <SliderField
          label={t('texture.envIntensity')}
          value={preview.envIntensity}
          {...PREVIEW_BOUNDS.envIntensity}
          onChange={value => onPreview('envIntensity', value)}
          {...edit.gesture}
        />
        <SliderField
          label={t('texture.envRotation')}
          value={toDegrees(preview.envRotation)}
          min={0}
          max={360}
          step={1}
          onChange={value => onPreview('envRotation', toRadians(value))}
          {...edit.gesture}
        />
        <ToggleField
          label={t('texture.showBackground')}
          value={preview.showBackground}
          onChange={value => onPreview('showBackground', value)}
        />
        <ToggleField
          label={t('texture.autoSpin')}
          value={preview.autoSpin}
          onChange={value => onPreview('autoSpin', value)}
        />
      </PropertySection>

      {/* The very section the 3D space shows, because it is the same question: a texture judged
          under a flat lamp is not judged, and the skies on offer are the project's own. */}
      <EnvironmentSection
        environment={preview.environment}
        onChange={next => onPreview('environment', next)}
      />
    </>
  )
}

/**
 * What the wrap edge of this texture measures, and the button that asks. On demand rather than
 * on every change: it is a GPU pass over the base colour, and a reading nobody looked at is a
 * context opened for nothing.
 */
function SeamReading({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const source = useTextures(
    state => textureOf(state, documentId).channels.baseColor?.assetId ?? null,
  )
  const seam = useTextureViews(state => seamOf(state, documentId))
  const [measuring, setMeasuring] = useState(false)

  // Only for the picture it was read off: a base colour replaced since leaves words on screen
  // about pixels the document no longer points at.
  const verdict = seam && seam.assetId === source ? seamVerdict(seam.ratio) : null

  /**
   * Reached by an `import()` rather than at the top of the file: the panels are in the opening
   * chunk, and the measurement carries three.js and a WebGL renderer behind it. A seam is
   * measured once in a while, by hand — the wait to fetch its chunk is the click itself.
   */
  const measure = async (): Promise<void> => {
    setMeasuring(true)
    try {
      const { measureTextureSeam } = await import('@/spaces/textures/measure-seam')
      await measureTextureSeam(documentId)
    } finally {
      setMeasuring(false)
    }
  }

  return (
    <PropertyRow label={t('texture.seams')}>
      <div className="flex items-center justify-end gap-2">
        {verdict && !measuring && (
          <span className="text-muted truncate">{t(SEAM_LABELS[verdict])}</span>
        )}
        <Button
          // Said rather than hidden: an empty base colour is something to go and fill.
          disabled={!source || measuring}
          {...HINT_LEFT(source ? t('texture.measureSeamHint') : t('texture.seamNoSource'))}
          onClick={() => void measure()}
        >
          {t(measuring ? 'texture.measuringSeam' : 'texture.measureSeam')}
        </Button>
      </div>
    </PropertyRow>
  )
}
