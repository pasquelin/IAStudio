import type { AdjustmentStack } from '@shared/domain/adjustments'

/**
 * The bounds and steps of each adjustment, as data. Both the bar under the viewport and the
 * panel on the right render this list, so the two can never disagree about what a range is —
 * and they would, being written in two files a fortnight apart.
 *
 * `label` is an i18n key, never a label: the same rule as `SceneEntry`.
 */
export type AdjustmentField = {
  key: keyof AdjustmentStack
  label: string
  min: number
  max: number
  step: number
}

export const ADJUSTMENT_FIELDS: readonly AdjustmentField[] = [
  { key: 'exposure', label: 'skybox.exposure', min: -4, max: 4, step: 0.05 },
  { key: 'contrast', label: 'skybox.contrast', min: 0, max: 2, step: 0.01 },
  { key: 'saturation', label: 'skybox.saturation', min: 0, max: 2, step: 0.01 },
  { key: 'temperature', label: 'skybox.temperature', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: 'skybox.tint', min: -1, max: 1, step: 0.01 },
  { key: 'rotationY', label: 'skybox.rotation', min: 0, max: Math.PI * 2, step: 0.01 },
  { key: 'blur', label: 'skybox.blur', min: 0, max: 1, step: 0.01 },
]
