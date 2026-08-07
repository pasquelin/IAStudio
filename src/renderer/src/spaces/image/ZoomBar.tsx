import { mdiFitToScreenOutline, mdiMagnifyMinusOutline, mdiMagnifyPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_TOP } from '@/helpers/tooltip'
import { MAX_SCALE, MIN_SCALE } from '@/engines/canvas/viewport'

export type ZoomBarProps = {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onActual: () => void
}

/** Whole percents up to 100%, one decimal below — 3% and 3.7% are different framings. */
export function zoomLabel(scale: number): string {
  const percent = scale * 100
  return `${percent >= 100 ? Math.round(percent) : Math.round(percent * 10) / 10} %`
}

/**
 * Where the zoom is, and the three ways out of it. It floats over the canvas rather than sitting
 * in a status bar: the document has no chrome of its own, and the eye looking for the zoom is
 * already on the image.
 */
export function ZoomBar({ scale, onZoomIn, onZoomOut, onFit, onActual }: ZoomBarProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface border-border absolute right-2 bottom-2 flex items-center gap-0.5 rounded-(--radius-sc-md) border p-0.5">
      <ToolButton
        icon={mdiMagnifyMinusOutline}
        label={t('imageView.zoomOut')}
        tooltip={TIP_TOP}
        variant="header"
        disabled={scale <= MIN_SCALE}
        onClick={onZoomOut}
      />
      {/* The readout is the button: clicking a zoom level to go back to 100% is the gesture
          every editor has taught. `ToolButton` without an icon renders exactly this. */}
      <ToolButton
        label={t('imageView.zoom')}
        description={t('imageView.actualHint')}
        tooltip={TIP_TOP}
        variant="header"
        className="text-muted w-auto px-1 tabular-nums"
        onClick={onActual}
      >
        {zoomLabel(scale)}
      </ToolButton>
      <ToolButton
        icon={mdiMagnifyPlusOutline}
        label={t('imageView.zoomIn')}
        tooltip={TIP_TOP}
        variant="header"
        disabled={scale >= MAX_SCALE}
        onClick={onZoomIn}
      />
      <ToolButton
        icon={mdiFitToScreenOutline}
        label={t('imageView.fit')}
        description={t('imageView.fitHint')}
        tooltip={TIP_TOP}
        variant="header"
        onClick={onFit}
      />
    </div>
  )
}
