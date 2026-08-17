import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/design/PropertySection'
import type { GestureProps } from '@/design/styles'
import type { FieldValue, PropertyField } from '@/engines/scene/propertyFields'
import { PropertyControl } from './PropertyControl'

export type DescriptorSectionProps = {
  title: string
  fields: readonly PropertyField[]
  onChange: (name: string, value: FieldValue) => void
  gesture: GestureProps
  /** What the descriptor carries beyond its plain fields — a material's texture slots. */
  children?: ReactNode
}

/**
 * A descriptor, rendered. Geometry, material and light differ only in which fields they list
 * and which command they end up running — so they share this, and adding a primitive adds no
 * component at all.
 */
export function DescriptorSection({
  title,
  fields,
  onChange,
  gesture,
  children,
}: DescriptorSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={title}>
      {fields.map(field => (
        <PropertyControl
          key={field.name}
          field={field}
          // The name itself when no translation exists: a parameter under a raw key still says
          // more than one silently left out.
          label={t(`inspector.fields.${field.name}`, field.name)}
          onChange={value => onChange(field.name, value)}
          gesture={gesture}
        />
      ))}
      {children}
    </PropertySection>
  )
}
