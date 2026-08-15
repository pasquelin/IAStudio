import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextDescriptor } from '@shared/domain/scene'
import { TextField } from '@/design/TextField'
import type { GestureProps } from '@/design/styles'
import { textFields, withField } from '@/engines/scene/property-fields'
import { DescriptorSection } from './DescriptorSection'
import { FontField } from './FontField'

export type TextSectionProps = {
  text: TextDescriptor
  onChange: (text: TextDescriptor) => void
  gesture: GestureProps
}

/**
 * What a text says, in what face, at what size. The words and the face are drawn apart from the
 * numbers: one is a caption and the other a list, and neither is something a numeric table can
 * describe — see `TEXT_SPECS`, which covers exactly what is left.
 */
export function TextSection({ text, onChange, gesture }: TextSectionProps) {
  const { t } = useTranslation()
  const fields = useMemo(() => textFields(text), [text])

  return (
    <DescriptorSection
      title={t('inspector.text')}
      fields={fields}
      onChange={(name, value) => onChange(withField(text, name, value))}
      gesture={gesture}
    >
      <TextField
        label={t('inspector.fields.value', 'value')}
        value={text.value}
        onChange={value => onChange({ ...text, value })}
        {...gesture}
      />
      <FontField
        label={t('inspector.font')}
        value={text.font}
        onChange={font => onChange({ ...text, font })}
      />
    </DescriptorSection>
  )
}
