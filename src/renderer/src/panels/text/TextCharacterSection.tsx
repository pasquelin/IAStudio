import { useTranslation } from 'react-i18next'
import { ColorField } from '@/design/ColorField'
import { NumberField } from '@/design/NumberField'
import { PropertySection } from '@/design/PropertySection'
import { setLayerText } from '@/engines/canvas/commands'
import { colourOf, packedColour } from '@shared/domain/color'
import type { TextLayer } from '@/engines/canvas/canvasState'
import { FontField } from '@/panels/inspector/FontField'
import { useCanvases } from '@/stores/canvases'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type TextCharacterSectionProps = { documentId: string; layer: TextLayer }

/** How far apart the tracking dial swings, in the thousandths of an em a type panel shows. */
const TRACKING_REACH = 400

/** What a colour the picker could not read falls back to, rather than a silent nothing. */
const INK = 0x000000

/** What a letter is drawn with: its face, its body, its leading, its tracking and its ink. */
export function TextCharacterSection({ documentId, layer }: TextCharacterSectionProps) {
  const { t } = useTranslation()
  const edit = useDocumentEdit(useCanvases, documentId)

  return (
    <PropertySection title={t('text.character')}>
      <FontField
        label={t('text.font')}
        value={layer.font}
        onChange={font => edit.run(setLayerText(layer.id, { font }))}
        scId="text.font"
      />

      <NumberField
        label={t('text.size')}
        value={layer.size}
        min={1}
        step={1}
        onChange={size => edit.run(setLayerText(layer.id, { size }))}
        {...edit.gesture}
      />

      {/* A multiple rather than a point count: a caption set bigger keeps its leading. */}
      <NumberField
        label={t('text.lineHeight')}
        value={layer.lineHeight}
        min={0.5}
        max={4}
        step={0.05}
        onChange={lineHeight => edit.run(setLayerText(layer.id, { lineHeight }))}
        {...edit.gesture}
      />

      <NumberField
        label={t('text.tracking')}
        value={layer.tracking}
        min={-TRACKING_REACH}
        max={TRACKING_REACH}
        step={5}
        onChange={tracking => edit.run(setLayerText(layer.id, { tracking }))}
        {...edit.gesture}
      />

      <ColorField
        label={t('text.colour')}
        value={colourOf(layer.color)}
        onChange={hex => edit.run(setLayerText(layer.id, { color: packedColour(hex) ?? INK }))}
        scId="text.colour"
        {...edit.gesture}
      />
    </PropertySection>
  )
}
