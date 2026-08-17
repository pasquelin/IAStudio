import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { snapSteps } from './snapSteps'

const view = DEFAULT_SETTINGS.three

describe('snapSteps', () => {
  it('frees every axis while snapping is off', () => {
    expect(snapSteps(view, false)).toEqual({ translate: null, rotate: null, scale: null })
  })

  it('hands the settings through untouched, except the angle', () => {
    const steps = snapSteps({ ...view, snapTranslate: 0.25, snapScale: 0.05 }, true)

    expect(steps.translate).toBe(0.25)
    expect(steps.scale).toBe(0.05)
  })

  it('turns the angle into radians, which is what three.js counts in', () => {
    expect(snapSteps({ ...view, snapRotate: 90 }, true).rotate).toBeCloseTo(Math.PI / 2)
    expect(snapSteps({ ...view, snapRotate: 15 }, true).rotate).toBeCloseTo(Math.PI / 12)
  })

  // The steps are a setting, the switch is a session thing: a step changed while snapping is off
  // has to be waiting when it comes on.
  it('reads the current settings rather than the ones snapping was switched on with', () => {
    expect(snapSteps({ ...view, snapTranslate: 2 }, true).translate).toBe(2)
    expect(snapSteps({ ...view, snapTranslate: 2 }, false).translate).toBeNull()
  })
})
