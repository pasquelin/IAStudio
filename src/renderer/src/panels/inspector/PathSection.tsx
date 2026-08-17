import { mdiPlus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { PathDescriptor } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import type { GestureProps } from '@/design/styles'
import { withPointAfter } from '@/engines/scene/cameraPath'
import { TIP_LEFT } from '@/helpers/tooltip'

/** Zero is angular, one is as round as a Catmull-Rom curve gets. */
const MAX_TENSION = 1

export type PathSectionProps = {
  path: PathDescriptor
  onChange: (path: PathDescriptor) => void
  gesture: GestureProps
}

/**
 * The shape of a rail: how round it runs, whether it closes on itself, and how many points it
 * is made of.
 *
 * The points themselves are not listed as fields: three numbers each, in a column, is a table
 * nobody can aim with — they are dragged in the viewport, and this section only ever adds one.
 */
export function PathSection({ path, onChange, gesture }: PathSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.path')}>
      <SliderField
        label={t('inspector.fields.tension')}
        value={path.tension}
        min={0}
        max={MAX_TENSION}
        step={0.05}
        onChange={tension => onChange({ ...path, tension })}
        {...gesture}
      />
      <ToggleField
        label={t('inspector.fields.closed')}
        value={path.closed}
        onChange={closed => onChange({ ...path, closed })}
      />
      <div className="flex items-center justify-between px-2">
        <span className="text-muted text-tiny">{t('inspector.pathPoints')}</span>
        <ToolButton
          icon={mdiPlus}
          label={t('inspector.addPathPoint')}
          description={t('inspector.addPathPointHint')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={() => onChange(withPointAfter(path, path.points.length - 1))}
        />
      </div>
    </PropertySection>
  )
}
