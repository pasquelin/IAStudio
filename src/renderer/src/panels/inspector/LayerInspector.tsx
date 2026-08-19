import { useTranslation } from 'react-i18next'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { NumberField } from '@/design/NumberField'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { SelectField } from '@/design/SelectField'
import { SliderField } from '@/design/SliderField'
import { TextField } from '@/design/TextField'
import { ToggleField } from '@/design/ToggleField'
import { BLEND_MODES, type BlendMode } from '@shared/domain/canvasBlend'
import {
  isGroup,
  type AdjustmentKind,
  type Layer,
  type Transform,
} from '@/engines/canvas/canvasState'
import {
  setLayerAdjustment,
  setLayerBlend,
  setLayerClipped,
  setLayerFillOpacity,
  setLayerLocks,
  setLayerOpacity,
  setLayerText,
  setLayerTransform,
} from '@/engines/canvas/commands'
import { LAYER_LOCKS } from '@/panels/layers/layerLocks'
import { useCanvases } from '@/stores/canvases'
import { FontField } from './FontField'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type LayerInspectorProps = { documentId: string; layer: Layer }

/** How far each dial swings. Its name is its key: `AdjustmentKind` is a subset of the stack. */
const DIAL_RANGE: Readonly<Record<AdjustmentKind, { min: number; max: number }>> = {
  // Stops, so ±3 is the range a photograph is recoverable within.
  exposure: { min: -3, max: 3 },
  contrast: { min: 0, max: 2 },
  saturation: { min: 0, max: 2 },
  temperature: { min: -1, max: 1 },
}

/**
 * One layer, read out and edited. Its own section rather than the scene's `TransformSection`:
 * a layer turns in a plane and skews, a node turns in three axes and does not — the two share a
 * word and nothing else.
 */
export function LayerInspector({ documentId, layer }: LayerInspectorProps) {
  const { t } = useTranslation()
  // The same seam every other face uses: without its gesture props a slider drag writes one
  // history entry per emitted value, and a hundred of them evict everything before them.
  const edit = useDocumentEdit(useCanvases, documentId)
  const move = (changes: Partial<Transform>): void =>
    edit.run(setLayerTransform(layer.id, { ...layer.transform, ...changes }))

  return (
    <>
      <PropertyGroup title={t('inspector.layer')}>
        <PropertyRow label={t('inspector.name')}>{layer.name}</PropertyRow>
        <PropertyRow label={t('inspector.kind')}>
          {t(`inspector.layerKind_${layer.kind}`)}
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup title={t('inspector.compositing')}>
        <SelectField
          label={t('inspector.blend')}
          value={layer.blend}
          options={BLEND_MODES.map(mode => ({ value: mode, label: t(`blend.${mode}`) }))}
          onChange={blend => edit.run(setLayerBlend(layer.id, blend))}
          scId="layer.blend"
        />

        <SliderField
          label={t('inspector.opacity')}
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => edit.run(setLayerOpacity(layer.id, value))}
          {...edit.gesture}
        />
        {/* Distinct from the one above: it fades the pixels and leaves the effects drawn around
            them alone. No layer effect exists yet, so today the two simply multiply. */}
        <SliderField
          label={t('inspector.fillOpacity')}
          value={layer.fillOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => edit.run(setLayerFillOpacity(layer.id, value))}
          {...edit.gesture}
        />

        <ToggleField
          label={t('inspector.clipped')}
          value={layer.clipped}
          onChange={value => edit.run(setLayerClipped(layer.id, value))}
        />
      </PropertyGroup>

      <PropertyGroup title={t('inspector.locks')}>
        {LAYER_LOCKS.map(padlock => (
          <ToggleField
            key={padlock.key}
            label={t(padlock.labelKey)}
            value={layer.locked[padlock.key]}
            onChange={value =>
              edit.run(setLayerLocks(layer.id, { ...layer.locked, [padlock.key]: value }))
            }
          />
        ))}
      </PropertyGroup>

      {layer.kind === 'text' && (
        <PropertyGroup title={t('inspector.text')}>
          <TextField
            label={t('inspector.words')}
            value={layer.text}
            onChange={text => edit.run(setLayerText(layer.id, { text }))}
            {...edit.gesture}
          />
          <NumberField
            label={t('inspector.textSize')}
            value={layer.size}
            min={1}
            step={1}
            onChange={size => edit.run(setLayerText(layer.id, { size }))}
            {...edit.gesture}
          />
          {/* The very field a 3D text uses, from the very list: the same caption reads the same
              in both workspaces, or neither is worth having. */}
          <FontField
            label={t('inspector.font')}
            value={layer.font}
            onChange={font => edit.run(setLayerText(layer.id, { font }))}
          />
        </PropertyGroup>
      )}

      {layer.kind === 'adjustment' && (
        <PropertyGroup title={t(`adjustment.${layer.adjustment}`)}>
          <SliderField
            label={t(`adjustment.${layer.adjustment}`)}
            value={layer.values[layer.adjustment]}
            min={DIAL_RANGE[layer.adjustment].min}
            max={DIAL_RANGE[layer.adjustment].max}
            step={0.01}
            onChange={value =>
              edit.run(
                setLayerAdjustment(layer.id, {
                  ...layer.values,
                  [layer.adjustment]: value,
                }),
              )
            }
            {...edit.gesture}
          />
        </PropertyGroup>
      )}

      {/* A group has no pixels of its own, but it does have a place: it carries its children. */}
      <PropertyGroup title={t('inspector.transform')}>
        <NumberField
          label={t('inspector.x')}
          value={layer.transform.x}
          step={1}
          onChange={value => move({ x: value })}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.y')}
          value={layer.transform.y}
          step={1}
          onChange={value => move({ y: value })}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.rotation')}
          value={toDegrees(layer.transform.rotation)}
          step={1}
          onChange={value => move({ rotation: toRadians(value) })}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.scaleX')}
          value={layer.transform.scaleX}
          step={0.1}
          onChange={value => move({ scaleX: value })}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.scaleY')}
          value={layer.transform.scaleY}
          step={0.1}
          onChange={value => move({ scaleY: value })}
          {...edit.gesture}
        />
        {isGroup(layer) && (
          <PropertyRow label={t('inspector.children')}>{layer.children.length}</PropertyRow>
        )}
      </PropertyGroup>
    </>
  )
}
