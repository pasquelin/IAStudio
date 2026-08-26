import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { DisplayUnit } from '@shared/domain/scene'
import { SNAP_READING_KEYS, type SnapReading } from '@/spaces/three/SceneSnapBar/sceneSnapControls'
import { snapFigure } from '@/spaces/three/SceneSnapBar/snapFigure'

/** How a snap step reads: its figure in the display unit, wearing the symbol its kind takes. */
export type SnapReader = (reads: SnapReading, step: number) => string

/**
 * Written once because the bar and its menu both compose it — the same three lines over the same
 * `reads`, `step` and unit. They agreed; what this removes is the second place to change.
 */
export function useSnapReading(unit: DisplayUnit): SnapReader {
  const { t, i18n } = useTranslation()

  return useCallback(
    (reads, step) =>
      t(SNAP_READING_KEYS[reads], {
        value: snapFigure(step, reads, unit, i18n.language),
        unit: t(SNAP_UNIT_KEYS[unit]),
      }),
    [t, i18n.language, unit],
  )
}

/**
 * The symbol a length wears, keyed by unit. Written out rather than composed at the call site:
 * a key built from a value at runtime is a key no guard can see, and an unseen key shows raw.
 */
const SNAP_UNIT_KEYS: Record<DisplayUnit, string> = {
  mm: 'snapBar.unitMm',
  cm: 'snapBar.unitCm',
  m: 'snapBar.unitM',
}
