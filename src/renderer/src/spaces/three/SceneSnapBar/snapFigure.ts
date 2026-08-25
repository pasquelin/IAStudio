import type { DisplayUnit } from '@shared/domain/scene'
import { toDisplayLength } from '@shared/domain/units'
import { formatDecimal } from '@/helpers/format'
import type { SnapReading } from './sceneSnapControls'

/** Enough for the finest value each list holds: a ratio goes to 0.015625, the rest to 0.001. */
const DIGITS: Record<SnapReading, number> = { length: 3, angle: 3, ratio: 6 }

/**
 * What a snap step reads as, without its symbol — the caller adds that, translated.
 *
 * A length is turned into the display unit on the way out, exactly as the inspector does: the
 * document holds metres whatever `three.units` says, and a bar showing metres beside an inspector
 * showing millimetres would be two readings of one number.
 */
export function snapFigure(
  value: number,
  reads: SnapReading,
  unit: DisplayUnit,
  language: string,
): string {
  return formatDecimal(reads === 'length' ? toDisplayLength(value, unit) : value, language, {
    digits: DIGITS[reads],
    grouped: false,
  })
}
