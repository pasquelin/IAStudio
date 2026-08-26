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
  /** What this section is called in code, so each of its fields can be named from a script. */
  scId: string
  /** What the descriptor carries beyond its plain fields — a material's texture slots. */
  children?: ReactNode
  /**
   * The bundle the labels are read from, completed by each field's own name. The inspector's own
   * by default; the composition panel names its parameters under `postfx.param_`.
   */
  labelPrefix?: string
  /** A button drawn at the end of one field's line — the keyframe diamond, per parameter. */
  actionFor?: (name: string) => ReactNode
  /** Drawn open. Absent leaves `PropertySection` to its own default. */
  defaultOpen?: boolean
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
  scId,
  children,
  labelPrefix = 'inspector.fields.',
  actionFor,
  defaultOpen,
}: DescriptorSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={title} scId={scId} defaultOpen={defaultOpen}>
      {fields.map(field => (
        <PropertyControl
          key={field.name}
          field={field}
          // The name itself when no translation exists: a parameter under a raw key still says
          // more than one silently left out.
          label={t(`${labelPrefix}${field.name}`, field.name)}
          onChange={value => onChange(field.name, value)}
          gesture={gesture}
          section={scId}
          action={actionFor?.(field.name)}
        />
      ))}
      {children}
    </PropertySection>
  )
}
