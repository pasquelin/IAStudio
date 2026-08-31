import { useTranslation } from 'react-i18next'
import { resetTo } from '@/helpers/resetTo'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { NumberField } from '@/components/NumberField'
import { PropertySection } from '@/components/PropertySection'
import { PropertyRow } from '@/components/PropertyRow'
import { SelectField } from '@/components/SelectField'
import { SliderField } from '@/components/SliderField'
import { TextField } from '@/components/TextField'
import { ToggleField } from '@/components/ToggleField'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import {
  DIAL_RANGE,
  IDENTITY,
  isGroup,
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
import { FontField } from '../FontField'
import { LayerShapeSection } from './LayerShapeSection'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type LayerInspectorProps = { documentId: string; layer: Layer }

/** An opacity nobody has touched. Named rather than written twice, once per row. */
const FULL = 1

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
      <PropertySection title={t('inspector.layer')} scId="layer">
        <PropertyRow label={t('inspector.name')}>{layer.name}</PropertyRow>
        <PropertyRow label={t('inspector.kind')}>
          {t(`inspector.layerKind_${layer.kind}`)}
        </PropertyRow>
      </PropertySection>

      <PropertySection title={t('inspector.compositing')} scId="layer.compositing">
        <SelectField
          label={t('inspector.blend')}
          value={layer.blend}
          options={BLEND_MODES.map(mode => ({ value: mode, label: t(`blend.${mode}`) }))}
          onChange={blend => edit.run(setLayerBlend(layer.id, blend))}
          scId="layer.blend"
        />

        <SliderField
          label={t('inspector.opacity')}
          scId="layer.opacity"
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => edit.run(setLayerOpacity(layer.id, value))}
          onReset={resetTo(layer.opacity, FULL, value =>
            edit.run(setLayerOpacity(layer.id, value)),
          )}
          {...edit.gesture}
        />
        {/* Distinct from the one above: it fades the pixels and leaves the effects drawn around
            them alone. No layer effect exists yet, so today the two simply multiply. */}
        <SliderField
          label={t('inspector.fillOpacity')}
          scId="layer.fillOpacity"
          value={layer.fillOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => edit.run(setLayerFillOpacity(layer.id, value))}
          onReset={resetTo(layer.fillOpacity, FULL, value =>
            edit.run(setLayerFillOpacity(layer.id, value)),
          )}
          {...edit.gesture}
        />

        <ToggleField
          label={t('inspector.clipped')}
          scId="layer.clipped"
          value={layer.clipped}
          onChange={value => edit.run(setLayerClipped(layer.id, value))}
        />
      </PropertySection>

      <PropertySection title={t('inspector.locks')} scId="layer.locks">
        {LAYER_LOCKS.map(padlock => (
          <ToggleField
            key={padlock.key}
            label={t(padlock.labelKey)}
            // The padlock's own key, never its label: the four read differently in each language.
            scId={`layer.lock.${padlock.key}`}
            value={layer.locked[padlock.key]}
            onChange={value =>
              edit.run(setLayerLocks(layer.id, { ...layer.locked, [padlock.key]: value }))
            }
          />
        ))}
      </PropertySection>

      {layer.kind === 'text' && (
        <PropertySection title={t('inspector.text')} scId="layer.text">
          <TextField
            label={t('inspector.words')}
            scId="layer.words"
            value={layer.text}
            onChange={text => edit.run(setLayerText(layer.id, { text }))}
            {...edit.gesture}
          />
          <NumberField
            label={t('inspector.textSize')}
            scId="layer.textSize"
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
            scId="layer.font"
          />
        </PropertySection>
      )}

      {layer.kind === 'shape' && <LayerShapeSection layer={layer} edit={edit} />}

      {layer.kind === 'adjustment' && (
        <PropertySection title={t(`adjustment.${layer.adjustment}`)} scId="layer.adjustment">
          <SliderField
            label={t(`adjustment.${layer.adjustment}`)}
            // The dial's own name, which is what the layer holds — the title beside it is the
            // translated one, and the two are only ever equal by accident.
            scId={`layer.adjustment.${layer.adjustment}`}
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
            onReset={resetTo(
              layer.values[layer.adjustment],
              NEUTRAL_ADJUSTMENTS[layer.adjustment],
              value =>
                edit.run(
                  setLayerAdjustment(layer.id, { ...layer.values, [layer.adjustment]: value }),
                ),
            )}
            {...edit.gesture}
          />
        </PropertySection>
      )}

      {/* A group has no pixels of its own, but it does have a place: it carries its children. */}
      <PropertySection title={t('inspector.transform')} scId="layer.transform">
        <NumberField
          label={t('inspector.x')}
          scId="layer.x"
          value={layer.transform.x}
          step={1}
          onChange={value => move({ x: value })}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.y')}
          scId="layer.y"
          value={layer.transform.y}
          step={1}
          onChange={value => move({ y: value })}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.rotation')}
          scId="layer.rotation"
          value={toDegrees(layer.transform.rotation)}
          step={1}
          onChange={value => move({ rotation: toRadians(value) })}
          // The RAW angle, not the degrees the field shows: `onChange` converts, this does not.
          onReset={resetTo(layer.transform.rotation, IDENTITY.rotation, rotation =>
            move({ rotation }),
          )}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.scaleX')}
          scId="layer.scaleX"
          value={layer.transform.scaleX}
          step={0.1}
          onChange={value => move({ scaleX: value })}
          onReset={resetTo(layer.transform.scaleX, IDENTITY.scaleX, scaleX => move({ scaleX }))}
          {...edit.gesture}
        />
        <NumberField
          label={t('inspector.scaleY')}
          scId="layer.scaleY"
          value={layer.transform.scaleY}
          step={0.1}
          onChange={value => move({ scaleY: value })}
          onReset={resetTo(layer.transform.scaleY, IDENTITY.scaleY, scaleY => move({ scaleY }))}
          {...edit.gesture}
        />
        {isGroup(layer) && (
          <PropertyRow label={t('inspector.children')}>{layer.children.length}</PropertyRow>
        )}
      </PropertySection>
    </>
  )
}
