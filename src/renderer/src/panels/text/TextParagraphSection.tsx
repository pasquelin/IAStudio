import {
  mdiFormatAlignCenter,
  mdiFormatAlignJustify,
  mdiFormatAlignLeft,
  mdiFormatAlignRight,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { NumberField } from '@/design/NumberField'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { ToolButton } from '@/design/ToolButton'
import { TEXT_ALIGNS, type TextAlign, type TextLayer } from '@/engines/canvas/canvasState'
import { setLayerText } from '@/engines/canvas/commands'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useCanvases } from '@/stores/canvases'
import { useDocumentEdit } from '@/hooks/useDocumentEdit'

export type TextParagraphSectionProps = { documentId: string; layer: TextLayer }

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
  const resize = (box: Partial<TextLayer['box']>): void =>
    edit.run(setLayerText(layer.id, { box: { ...layer.box, ...box } }))

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

      {/* The box the words WRAP in, never what cuts them: a caption that outgrows it spills. */}
      <NumberField
        label={t('text.boxWidth')}
        value={layer.box.width}
        min={1}
        step={1}
        onChange={width => resize({ width })}
        {...edit.gesture}
      />

      <NumberField
        label={t('text.boxHeight')}
        value={layer.box.height}
        min={1}
        step={1}
        onChange={height => resize({ height })}
        {...edit.gesture}
      />
    </PropertySection>
  )
}
