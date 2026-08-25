import { describe, expect, it } from 'vitest'
import { boundsOf } from './settingsRegistry'
import type { SettingPath } from './settingsPath'
import {
  EVERYTHING_SNAPPED,
  FLY_SPEEDS,
  NOTHING_SNAPPED,
  SNAP_ROTATE_DIVISIONS,
  SNAP_ROTATE_STEPS,
  SNAP_SCALE_RATIOS,
  SNAP_TRANSLATE_STEPS,
  isSnapping,
  snappingToggled,
} from './snap'

describe('isSnapping', () => {
  it('answers for the whole document, not for one kind', () => {
    expect(isSnapping(NOTHING_SNAPPED)).toBe(false)
    expect(isSnapping({ ...NOTHING_SNAPPED, rotate: true })).toBe(true)
  })
})

describe('snappingToggled', () => {
  it('turns everything off while anything is on', () => {
    expect(snappingToggled({ ...NOTHING_SNAPPED, surface: true }, NOTHING_SNAPPED)).toEqual(
      NOTHING_SNAPPED,
    )
  })

  it('gives back exactly what was on, so one press undoes the other', () => {
    const held = { ...NOTHING_SNAPPED, translate: true, scale: true }

    expect(snappingToggled(NOTHING_SNAPPED, held)).toEqual(held)
  })

  it('turns all four on when nothing was ever on to give back', () => {
    expect(snappingToggled(NOTHING_SNAPPED, NOTHING_SNAPPED)).toEqual(EVERYTHING_SNAPPED)
  })
})

// A value the bar offers and the main refuses is written, ignored and never reported: `validation`
// bounds each of these paths, and a list drifting past a bound would fail in silence.
describe('the values offered', () => {
  const within = (path: SettingPath, values: readonly number[]) => {
    const { min, max } = boundsOf(path)
    return values.filter(value => value < min || value > max)
  }

  it('stays inside the bounds each setting declares', () => {
    expect(within('three.snapTranslate', SNAP_TRANSLATE_STEPS)).toEqual([])
    expect(within('three.snapRotate', [...SNAP_ROTATE_STEPS, ...SNAP_ROTATE_DIVISIONS])).toEqual([])
    expect(within('three.snapScale', SNAP_SCALE_RATIOS)).toEqual([])
    expect(within('three.flySpeed', FLY_SPEEDS)).toEqual([])
  })
})
