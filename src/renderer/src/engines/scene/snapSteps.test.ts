import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { EVERYTHING_SNAPPED, NOTHING_SNAPPED } from '@shared/domain/snap'
import { snapSteps } from './snapSteps'

const view = DEFAULT_SETTINGS.three

describe('snapSteps', () => {
  it('frees every axis while nothing is snapped', () => {
    expect(snapSteps(view, NOTHING_SNAPPED)).toEqual({ translate: null, rotate: null, scale: null })
  })

  it('hands the settings through untouched, except the angle', () => {
    const steps = snapSteps({ ...view, snapTranslate: 0.25, snapScale: 0.05 }, EVERYTHING_SNAPPED)

    expect(steps.translate).toBe(0.25)
    expect(steps.scale).toBe(0.05)
  })

  it('turns the angle into radians, which is what three.js counts in', () => {
    expect(snapSteps({ ...view, snapRotate: 90 }, EVERYTHING_SNAPPED).rotate).toBeCloseTo(
      Math.PI / 2,
    )
  })

  // The point of four switches: laying a prop on the floor while its angle stays free.
  it('frees one kind without touching the others', () => {
    const steps = snapSteps(view, { ...EVERYTHING_SNAPPED, rotate: false })

    expect(steps.rotate).toBeNull()
    expect(steps.translate).toBe(view.snapTranslate)
    expect(steps.scale).toBe(view.snapScale)
  })

  // The steps are a setting, the switch is a session thing: a step changed while its snap is off
  // has to be waiting when it comes on.
  it('reads the current settings rather than the ones snapping was switched on with', () => {
    expect(snapSteps({ ...view, snapTranslate: 2 }, EVERYTHING_SNAPPED).translate).toBe(2)
    expect(snapSteps({ ...view, snapTranslate: 2 }, NOTHING_SNAPPED).translate).toBeNull()
  })
})
