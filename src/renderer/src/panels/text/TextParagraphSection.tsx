import {
  mdiFormatAlignCenter,
  mdiFormatAlignJustify,
  mdiFormatAlignLeft,
  mdiFormatAlignRight,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { NumberField } from '@/design/NumberField'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { ToolButton } from '@/design/ToolButton'
import { TEXT_ALIGNS, type TextAlign, type TextLayer } from '@/engines/canvas/canvasState'
import { setLayerText } from '@/engines/canvas/commands'
import type { Size } from '@/engines/core/geometry'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useCanvases } from '@/stores/canvases'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type TextParagraphSectionProps = { documentId: string; layer: TextLayer }

/** What a caption given a box by the panel starts at — a drag names its own. */
const DEFAULT_PARAGRAPH_BOX: Size = { width: 480, height: 120 }

const ALIGN_ICONS: Record<TextAlign, string> = {
  left: mdiFormatAlignLeft,
  center: mdiFormatAlignCenter,
  right: mdiFormatAlignRight,
  justify: mdiFormatAlignJustify,
}

/** How the lines sit in the box: which edge they hang from, and how wide that box is. */
export function TextParagraphSection({ documentId, layer }: TextParagraphSectionProps) {
  const { t } = useTranslation()
  const edit = useDocumentEdit(useCanvases, documentId)
  const box = layer.box
  const resize = (changes: Partial<Size>): void => {
    if (box) edit.run(setLayerText(layer.id, { box: { ...box, ...changes } }))
  }

  return (
    <PropertySection title={t('text.paragraph')}>
      <PropertyRow label={t('text.align')}>
        <div className="flex gap-1.5">
          {TEXT_ALIGNS.map(align => (
            <ToolButton
              key={align}
              icon={ALIGN_ICONS[align]}
              label={t(`text.align_${align}`)}
              tooltip={TIP_LEFT}
              active={layer.align === align}
              onClick={() => edit.run(setLayerText(layer.id, { align }))}
              data-sc={`field:text.align.${align}`}
            />
          ))}
        </div>
      </PropertyRow>

      {/* A POINT caption has no box to size — its line simply grows. Pulling a grip gives it one,
          and so does this row, which is the only way to reach it from the keyboard. */}
      {box === null ? (
        <PropertyRow label={t('text.flow')}>
          <Button
            data-sc="field:text.intoParagraph"
            onClick={() => edit.run(setLayerText(layer.id, { box: { ...DEFAULT_PARAGRAPH_BOX } }))}
          >
            {t('text.intoParagraph')}
          </Button>
        </PropertyRow>
      ) : (
        <>
          <NumberField
            label={t('text.boxWidth')}
            value={box.width}
            min={1}
            step={1}
            onChange={width => resize({ width })}
            {...edit.gesture}
          />

          <NumberField
            label={t('text.boxHeight')}
            value={box.height}
            min={1}
            step={1}
            onChange={height => resize({ height })}
            {...edit.gesture}
          />
        </>
      )}
    </PropertySection>
  )
}
