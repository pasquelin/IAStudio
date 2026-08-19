import { mdiPlus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { DEFAULT_PATH, type PathDescriptor } from '@shared/domain/scene'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import { ToolButton } from '@/design/ToolButton'
import type { GestureProps } from '@/design/styles'
import { withPointAtEnd } from '@/engines/scene/cameraPath'
import { TIP_LEFT } from '@/helpers/tooltip'

/** Zero is angular, one is as round as a Catmull-Rom curve gets. */
const MAX_TENSION = 1

export type PathSectionProps = {
  path: PathDescriptor
  onChange: (path: PathDescriptor) => void
  gesture: GestureProps
}

/**
 * The shape of a rail. Its points are not listed as fields — three numbers each in a column is a
 * table nobody can aim with; they are dragged in the viewport, and this only ever adds one.
 */
export function PathSection({ path, onChange, gesture }: PathSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.rail')}>
      <SliderField
        label={t('inspector.fields.tension')}
        value={path.tension}
        min={0}
        max={MAX_TENSION}
        step={0.05}
        onChange={tension => onChange({ ...path, tension })}
        onReset={
          path.tension === DEFAULT_PATH.tension
            ? undefined
            : () => onChange({ ...path, tension: DEFAULT_PATH.tension })
        }
        {...gesture}
      />
      <ToggleField
        label={t('inspector.fields.closed')}
        value={path.closed}
        onChange={closed => onChange({ ...path, closed })}
      />
      <PropertyRow label={t('inspector.pathPoints')}>
        <ToolButton
          icon={mdiPlus}
          label={t('inspector.addPathPoint')}
          description={t('inspector.addPathPointHint')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={() => onChange(withPointAtEnd(path))}
        />
      </PropertyRow>
    </PropertySection>
  )
}
