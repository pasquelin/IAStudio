import { useTranslation } from 'react-i18next'
import { ColorField } from '@/design/ColorField'
import { NumberField } from '@/design/NumberField'
import { PropertySection } from '@/design/PropertySection'
import { ToggleField } from '@/design/ToggleField'
import { hexOf } from '@/engines/core/palette'
import { MAX_SIDES, MIN_SIDES } from '@/engines/canvas/shapeGeometry'
import { setLayerShape } from '@/engines/canvas/commands'
import type { CanvasState, ShapeLayer } from '@/engines/canvas/canvasState'
import type { DocumentEdit } from '@/hooks/useDocumentEdit'

export type LayerShapeSectionProps = { layer: ShapeLayer; edit: DocumentEdit<CanvasState> }

/** What a colour picker hands back, as the layer stores it. */
const packed = (hex: string): number => Number.parseInt(hex.slice(1), 16)

/** The paint the shape falls back to when it is switched on, so a tick is never a no-op. */
const INK = 0x000000

const DEFAULT_STROKE_WIDTH = 2

/**
 * The paint of a shape layer, editable long after the drag that drew it — which is the whole
 * point of keeping the shape rather than its pixels.
 */
export function LayerShapeSection({ layer, edit }: LayerShapeSectionProps) {
  const { t } = useTranslation()
  const ring = layer.shape === 'polygon' || layer.shape === 'star'

  return (
    <PropertySection title={t('inspector.shape')}>
      <ToggleField
        label={t('inspector.shapeFilled')}
        value={layer.fill !== null}
        onChange={filled => edit.run(setLayerShape(layer.id, { fill: filled ? INK : null }))}
        scId="layer.shapeFilled"
      />

      {layer.fill !== null && (
        <ColorField
          label={t('inspector.shapeFill')}
          value={hexOf(layer.fill)}
          onChange={hex => edit.run(setLayerShape(layer.id, { fill: packed(hex) }))}
          scId="layer.shapeFill"
          {...edit.gesture}
        />
      )}

      <ToggleField
        label={t('inspector.shapeStroked')}
        value={layer.stroke !== null}
        onChange={stroked =>
          edit.run(
            setLayerShape(layer.id, {
              stroke: stroked ? { color: INK, width: DEFAULT_STROKE_WIDTH } : null,
            }),
          )
        }
        scId="layer.shapeStroked"
      />

      {layer.stroke && (
        <>
          <ColorField
            label={t('inspector.shapeStroke')}
            value={hexOf(layer.stroke.color)}
            onChange={hex =>
              edit.run(
                setLayerShape(layer.id, { stroke: { color: packed(hex), width: stroke(layer) } }),
              )
            }
            scId="layer.shapeStroke"
            {...edit.gesture}
          />
          <NumberField
            label={t('inspector.shapeStrokeWidth')}
            value={layer.stroke.width}
            min={1}
            step={1}
            onChange={width =>
              edit.run(setLayerShape(layer.id, { stroke: { color: colour(layer), width } }))
            }
            {...edit.gesture}
          />
        </>
      )}

      {ring && (
        <NumberField
          label={t('inspector.shapeSides')}
          value={layer.sides}
          min={MIN_SIDES}
          max={MAX_SIDES}
          step={1}
          onChange={sides => edit.run(setLayerShape(layer.id, { sides }))}
          {...edit.gesture}
        />
      )}
    </PropertySection>
  )
}

const stroke = (layer: ShapeLayer): number => layer.stroke?.width ?? DEFAULT_STROKE_WIDTH

const colour = (layer: ShapeLayer): number => layer.stroke?.color ?? INK
