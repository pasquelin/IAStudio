import { useTranslation } from 'react-i18next'
import { GROUND_SIZE, type SceneWorld } from '@shared/domain/scene'
import { ColorField } from '@/components/ColorField'
import { NumberField } from '@/components/NumberField'
import { PropertySection } from '@/components/PropertySection'
import { SliderField } from '@/components/SliderField'
import { ToggleField } from '@/components/ToggleField'
import type { GestureProps } from '@/components/styles'

export type EnvironmentGroundSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  showGrid: boolean
  gridSize: number
  onViewport: (patch: { showGrid?: boolean; gridSize?: number }) => void
  gesture: GestureProps
}

/** What a ground opens on when it has never carried a colour — a plain neutral. */
const FIRST_GROUND = '#9a9a9e'

/**
 * The two flat things under a scene, in one section and deliberately not one control: the GRID is
 * a ruler taken out of every render, the GROUND is an object of the document that catches shadows
 * and is in the picture. Merging them is what puts graph paper under a finished shot.
 */
export function EnvironmentGroundSection({
  world,
  onChange,
  showGrid,
  gridSize,
  onViewport,
  gesture,
}: EnvironmentGroundSectionProps) {
  const { t } = useTranslation()
  const ground = world.ground

  return (
    <PropertySection title={t('environment.ground')} defaultOpen={false} scId="ground">
      <ToggleField
        label={t('environment.gridVisible')}
        scId="environment.gridVisible"
        value={showGrid}
        onChange={value => onViewport({ showGrid: value })}
      />

      {showGrid && (
        <NumberField
          label={t('environment.gridSize')}
          scId="environment.gridSize"
          value={gridSize}
          min={2}
          max={500}
          step={1}
          onChange={value => onViewport({ gridSize: value })}
          {...gesture}
        />
      )}

      <ToggleField
        label={t('environment.groundVisible')}
        scId="environment.groundVisible"
        value={ground.visible}
        onChange={visible => onChange({ ground: { ...ground, visible } })}
      />

      {ground.visible && (
        <>
          <ColorField
            label={t('environment.groundColor')}
            scId="environment.groundColor"
            value={ground.color ?? FIRST_GROUND}
            onChange={color => onChange({ ground: { ...ground, color } })}
            {...gesture}
          />

          <NumberField
            label={t('environment.groundSize')}
            scId="environment.groundSize"
            value={ground.size}
            min={GROUND_SIZE.min}
            max={GROUND_SIZE.max}
            step={GROUND_SIZE.step}
            onChange={size => onChange({ ground: { ...ground, size } })}
            {...gesture}
          />

          <SliderField
            label={t('environment.groundOpacity')}
            scId="environment.groundOpacity"
            value={ground.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={opacity => onChange({ ground: { ...ground, opacity } })}
            {...gesture}
          />

          <ToggleField
            label={t('environment.groundShadows')}
            scId="environment.groundShadows"
            value={ground.receiveShadow}
            onChange={receiveShadow => onChange({ ground: { ...ground, receiveShadow } })}
          />
        </>
      )}
    </PropertySection>
  )
}
