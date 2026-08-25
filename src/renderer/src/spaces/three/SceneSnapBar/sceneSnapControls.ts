import { mdiAngleAcute, mdiGrid, mdiResize } from '@mdi/js'
import type { DisplayUnit } from '@shared/domain/scene'
import {
  SNAP_ROTATE_DIVISIONS,
  SNAP_ROTATE_STEPS,
  SNAP_SCALE_RATIOS,
  SNAP_TRANSLATE_STEPS,
  type SnapKind,
} from '@shared/domain/snap'

/**
 * How a figure reads. A length follows `three.units` and wears its symbol; an angle is always in
 * degrees, whatever a length is written in; a ratio wears nothing at all.
 */
export type SnapReading = 'length' | 'angle' | 'ratio'

export type SnapStepControl = {
  kind: SnapKind
  icon: string
  labelKey: string
  /** Two halves, one sentence: what the icon toggles, then what the menu sets. */
  descriptionKey: string
  /**
   * Names the menu half. Its own key rather than the toggle's: two buttons of one accessible
   * name, side by side, are two buttons a screen reader cannot tell apart.
   */
  stepsKey: string
  /** Which preference the menu writes. The switch beside it is per document, and is not here. */
  path: 'snapTranslate' | 'snapRotate' | 'snapScale'
  steps: readonly number[]
  /** A second column of 360 divided by a power of two — the one menu that has one. */
  divisions?: readonly number[]
  reads: SnapReading
}

/**
 * The three snaps that advance a drag BY an amount, declared once. The surface snap is not among
 * them: its menu is a form rather than a list of values, and it has its own component.
 */
export const SNAP_STEP_CONTROLS: readonly SnapStepControl[] = [
  {
    kind: 'translate',
    icon: mdiGrid,
    labelKey: 'snapBar.translate',
    descriptionKey: 'snapBar.translateHint',
    stepsKey: 'snapBar.translateSteps',
    path: 'snapTranslate',
    steps: SNAP_TRANSLATE_STEPS,
    reads: 'length',
  },
  {
    kind: 'rotate',
    icon: mdiAngleAcute,
    labelKey: 'snapBar.rotate',
    descriptionKey: 'snapBar.rotateHint',
    stepsKey: 'snapBar.rotateSteps',
    path: 'snapRotate',
    steps: SNAP_ROTATE_STEPS,
    divisions: SNAP_ROTATE_DIVISIONS,
    reads: 'angle',
  },
  {
    kind: 'scale',
    icon: mdiResize,
    labelKey: 'snapBar.scale',
    descriptionKey: 'snapBar.scaleHint',
    stepsKey: 'snapBar.scaleSteps',
    path: 'snapScale',
    steps: SNAP_SCALE_RATIOS,
    reads: 'ratio',
  },
]

/**
 * How a figure wears its symbol, closed on the bar and in its rows alike: a length takes the
 * unit, an angle a degree sign, a ratio nothing at all.
 */
export const SNAP_READING_KEYS: Record<SnapReading, string> = {
  length: 'snapBar.lengthValue',
  angle: 'snapBar.angleValue',
  ratio: 'snapBar.ratioValue',
}

/**
 * The symbol a length wears, keyed by unit. Written out rather than composed at the call site:
 * a key built from a value at runtime is a key no guard can see, and an unseen key shows raw.
 */
export const SNAP_UNIT_KEYS: Record<DisplayUnit, string> = {
  mm: 'snapBar.unitMm',
  cm: 'snapBar.unitCm',
  m: 'snapBar.unitM',
}
