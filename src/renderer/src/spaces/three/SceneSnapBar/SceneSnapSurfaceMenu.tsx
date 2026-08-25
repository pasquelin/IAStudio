import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import { boundsOf } from '@shared/domain/settingsRegistry'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'

// Read once: the registry answers by walking every descriptor.
const OFFSET = boundsOf('three.snapSurfaceOffset')

export type SceneSnapSurfaceMenuProps = {
  view: Settings['three']
  onViewport: (patch: Partial<Settings['three']>) => void
}

/**
 * The one snap whose menu is a form: laying something down has no list of amounts, it has how it
 * lands. Both are preferences, like the steps of the other three — only the switch is per
 * document.
 */
export function SceneSnapSurfaceMenu({ view, onViewport }: SceneSnapSurfaceMenuProps) {
  const { t } = useTranslation()

  return (
    <div className="w-48 p-1">
      <ToggleField
        label={t('snapBar.surfaceAlign')}
        scId="snapBar.surfaceAlign"
        value={view.snapSurfaceAlign}
        onChange={snapSurfaceAlign => onViewport({ snapSurfaceAlign })}
      />
      <SliderField
        label={t('snapBar.surfaceOffset')}
        scId="snapBar.surfaceOffset"
        value={view.snapSurfaceOffset}
        min={OFFSET.min}
        max={OFFSET.max}
        step={0.01}
        onChange={snapSurfaceOffset => onViewport({ snapSurfaceOffset })}
      />
    </div>
  )
}
