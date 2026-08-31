import { mdiFitToScreenOutline, mdiMagnifyMinusOutline, mdiMagnifyPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/components/ToolButton'
import { formatPercent } from '@/helpers/format'
import { TIP_TOP } from '@/helpers/tooltip'
import { CANVAS_MAX_SCALE, CANVAS_MIN_SCALE } from '@/engines/canvas/viewport'

export type ZoomBarProps = {
  scale: number
  /** Read off the command registry by the caller: a remapped key has to move on the bar too. */
  shortcuts: { zoomIn: string; zoomOut: string; fit: string; actual: string }
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onActual: () => void
}

/** Whole percents up to 100%, one decimal below — 3% and 3.7% are different framings. */
export function zoomLabel(scale: number, language: string): string {
  return formatPercent(scale, language, scale >= 1 ? 0 : 1)
}

/**
 * Where the zoom is, and the three ways out of it. It floats over the canvas rather than sitting
 * in a status bar: the document has no chrome of its own, and the eye looking for the zoom is
 * already on the image.
 */
export function ZoomBar({ scale, shortcuts, onZoomIn, onZoomOut, onFit, onActual }: ZoomBarProps) {
  const { t, i18n } = useTranslation()

  // Read once: the readout SHOWS it and its accessible name OPENS with it, and the two drifting
  // apart is the whole defect this button had (WCAG SC 2.5.3).
  const reading = zoomLabel(scale, i18n.language)

  return (
    <div className="bg-surface border-border absolute right-2 bottom-2 flex items-center gap-0.5 rounded-(--radius-sc-md) border p-0.5">
      <ToolButton
        icon={mdiMagnifyMinusOutline}
        label={t('imageView.zoomOut')}
        shortcut={shortcuts.zoomOut}
        tooltip={TIP_TOP}
        variant="header"
        disabled={scale <= CANVAS_MIN_SCALE}
        onClick={onZoomOut}
      />
      {/* The readout is the button: clicking a zoom level to go back to 100% is the gesture
          every editor has taught. `ToolButton` without an icon renders exactly this. */}
      <ToolButton
        label={t('imageView.zoom', { value: reading })}
        description={t('imageView.actualHint')}
        shortcut={shortcuts.actual}
        tooltip={TIP_TOP}
        variant="header"
        className="text-muted w-auto px-1 tabular-nums"
        onClick={onActual}
      >
        {reading}
      </ToolButton>
      <ToolButton
        icon={mdiMagnifyPlusOutline}
        label={t('imageView.zoomIn')}
        shortcut={shortcuts.zoomIn}
        tooltip={TIP_TOP}
        variant="header"
        disabled={scale >= CANVAS_MAX_SCALE}
        onClick={onZoomIn}
      />
      <ToolButton
        icon={mdiFitToScreenOutline}
        label={t('imageView.fit')}
        description={t('imageView.fitHint')}
        shortcut={shortcuts.fit}
        tooltip={TIP_TOP}
        variant="header"
        onClick={onFit}
      />
    </div>
  )
}
