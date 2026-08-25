import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import { boundsOf } from '@shared/domain/settingsRegistry'
import { Slider } from '@/design/Slider'
import { ToggleField } from '@/design/ToggleField'
import { formatDecimal } from '@/helpers/format'

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
  const { t, i18n } = useTranslation()

  return (
    // Wide enough for the two labels to READ: `PropertyLabel` truncates, and at a panel's width
    // these said « Orient… » and « Décala… », which name nothing at all.
    <div className="flex w-64 flex-col gap-2 p-1">
      <ToggleField
        label={t('snapBar.surfaceAlign')}
        scId="snapBar.surfaceAlign"
        value={view.snapSurfaceAlign}
        onChange={snapSurfaceAlign => onViewport({ snapSurfaceAlign })}
      />

      {/* `Slider` rather than `SliderField`, for the reason `SceneSpeedMenu` gives: that one is a
          property LINE, and its action column hangs off the edge of a flyout. */}
      <div className="text-tiny flex items-center gap-2">
        <span className="text-muted shrink-0">{t('snapBar.surfaceOffset')}</span>
        <Slider
          value={view.snapSurfaceOffset}
          min={OFFSET.min}
          max={OFFSET.max}
          step={0.01}
          scId="snapBar.surfaceOffset"
          onChange={snapSurfaceOffset => onViewport({ snapSurfaceOffset })}
          className="flex-1"
        />
        <span className="text-muted shrink-0 tabular-nums">
          {t('snapBar.lengthValue', {
            value: formatDecimal(view.snapSurfaceOffset, i18n.language, { digits: 2 }),
            unit: t('snapBar.unitM'),
          })}
        </span>
      </div>
    </div>
  )
}
