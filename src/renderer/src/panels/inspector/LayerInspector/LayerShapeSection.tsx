import { useTranslation } from 'react-i18next'
import { ColorField } from '@/design/ColorField'
import { NumberField } from '@/design/NumberField'
import { PropertySection } from '@/design/PropertySection'
import { ToggleField } from '@/design/ToggleField'
import { colourOf, packedColour } from '@shared/domain/color'
import {
  DEFAULT_STROKE_WIDTH,
  isOpenShape,
  MAX_SIDES,
  MIN_SIDES,
  // Imported, never written again: this panel held its own copy, so a shape ticked here and one
  // the assistant drew would have stopped agreeing the day the value moved.
  SHAPE_INK as INK,
} from '@/engines/canvas/shapeGeometry'
import { setLayerShape } from '@/engines/canvas/commands'
import type { CanvasState, ShapeLayer } from '@/engines/canvas/canvasState'
import type { DocumentEdit } from '@/hooks/useDocumentEdit'

export type LayerShapeSectionProps = { layer: ShapeLayer; edit: DocumentEdit<CanvasState> }

/**
 * The paint of a shape layer, editable long after the drag that drew it — which is the whole
 * point of keeping the shape rather than its pixels.
 */
export function LayerShapeSection({ layer, edit }: LayerShapeSectionProps) {
  const { t } = useTranslation()
  const ring = layer.shape === 'polygon' || layer.shape === 'star'
  // Held in a const rather than read off the layer: the narrowing survives into the callbacks,
  // where reading `layer.stroke` again would be `ShapeStroke | null` all over.
  const stroke = layer.stroke

  const closed = !isOpenShape(layer.shape)

  return (
    <PropertySection title={t('inspector.shape')} scId="shape">
      {closed && (
        <ToggleField
          label={t('inspector.shapeFilled')}
          value={layer.fill !== null}
          // Never both off: a shape with neither paints nothing, and a layer nobody can see is
          // a row in the stack with no way back from it.
          onChange={filled =>
            edit.run(
              setLayerShape(layer.id, {
                fill: filled ? INK : null,
                ...(filled || stroke
                  ? {}
                  : { stroke: { color: INK, width: DEFAULT_STROKE_WIDTH } }),
              }),
            )
          }
          scId="layer.shapeFilled"
        />
      )}

      {closed && layer.fill !== null && (
        <ColorField
          label={t('inspector.shapeFill')}
          value={colourOf(layer.fill)}
          onChange={hex => edit.run(setLayerShape(layer.id, { fill: packedColour(hex) ?? INK }))}
          scId="layer.shapeFill"
          {...edit.gesture}
        />
      )}

      {/* Not offered on a line or an arrow: their stroke is the whole of what they draw, so a
          switch that takes it away is a switch that erases the layer. */}
      {closed && (
        <ToggleField
          label={t('inspector.shapeStroked')}
          value={stroke !== null}
          onChange={stroked =>
            edit.run(
              setLayerShape(layer.id, {
                stroke: stroked ? { color: INK, width: DEFAULT_STROKE_WIDTH } : null,
                // The other half of the same rule: dropping the stroke of an unfilled shape
                // would leave nothing at all on screen.
                ...(stroked || layer.fill !== null ? {} : { fill: INK }),
              }),
            )
          }
          scId="layer.shapeStroked"
        />
      )}

      {stroke && (
        <>
          <ColorField
            label={t('inspector.shapeStroke')}
            value={colourOf(stroke.color)}
            onChange={hex =>
              edit.run(
                setLayerShape(layer.id, { stroke: { ...stroke, color: packedColour(hex) ?? INK } }),
              )
            }
            scId="layer.shapeStroke"
            {...edit.gesture}
          />
          <NumberField
            label={t('inspector.shapeStrokeWidth')}
            scId="shape.strokeWidth"
            value={stroke.width}
            min={1}
            step={1}
            onChange={width => edit.run(setLayerShape(layer.id, { stroke: { ...stroke, width } }))}
            {...edit.gesture}
          />
        </>
      )}

      {ring && (
        <NumberField
          label={t('inspector.shapeSides')}
          scId="shape.sides"
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
