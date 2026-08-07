import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { createSkyboxContent } from '@shared/domain/skybox'
import {
  resetAdjustments,
  setAdjustment,
  setEnvironmentSetting,
  setSource,
  setSunAngles,
  setSunSetting,
} from './commands'

describe('adjusting a skybox', () => {
  it('writes the value and gives the previous one back', () => {
    const before = createSkyboxContent()
    const command = setAdjustment('exposure', 1.5)

    const after = command.apply(before)
    expect(after.adjustments.exposure).toBe(1.5)
    expect(command.revert(after).adjustments.exposure).toBe(0)
  })

  it('leaves the rest of the stack alone', () => {
    const after = setAdjustment('contrast', 1.4).apply(createSkyboxContent())
    expect(after.adjustments.saturation).toBe(NEUTRAL_ADJUSTMENTS.saturation)
    expect(after.adjustments.exposure).toBe(NEUTRAL_ADJUSTMENTS.exposure)
  })

  it('never mutates the content it was handed', () => {
    const before = createSkyboxContent()
    setAdjustment('exposure', 3).apply(before)
    expect(before.adjustments.exposure).toBe(0)
  })

  it('carries one id per field, so two sliders are two undo entries', () => {
    expect(setAdjustment('exposure', 1).id).not.toBe(setAdjustment('contrast', 1).id)
  })

  it('carries the same id across a drag, so one gesture is one undo entry', () => {
    expect(setAdjustment('exposure', 1).id).toBe(setAdjustment('exposure', 2).id)
  })

  it('restores the whole stack after a reset', () => {
    const graded = setAdjustment('saturation', 0).apply(createSkyboxContent())
    const command = resetAdjustments()

    const reset = command.apply(graded)
    expect(reset.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
    expect(command.revert(reset).adjustments.saturation).toBe(0)
  })
})

describe('the sun', () => {
  it('moves both angles at once when dragged, under a single id', () => {
    const command = setSunAngles({ elevation: 0.2, azimuth: 3 })
    const after = command.apply(createSkyboxContent())

    expect(after.sun.elevation).toBe(0.2)
    expect(after.sun.azimuth).toBe(3)
    expect(command.id).toBe(setSunAngles({ elevation: 0.9, azimuth: 1 }).id)
  })

  it('keeps its colour and intensity when only the angles move', () => {
    const bright = setSunSetting('intensity', 4).apply(createSkyboxContent())
    const after = setSunAngles({ elevation: 1, azimuth: 1 }).apply(bright)
    expect(after.sun.intensity).toBe(4)
  })

  it('gives the previous angles back', () => {
    const before = createSkyboxContent()
    const command = setSunAngles({ elevation: 1.1, azimuth: 2.2 })
    expect(command.revert(command.apply(before)).sun).toEqual(before.sun)
  })
})

describe('the environment', () => {
  it('toggles the background and restores it', () => {
    const command = setEnvironmentSetting('showBackground', false)
    const hidden = command.apply(createSkyboxContent())

    expect(hidden.environment.showBackground).toBe(false)
    expect(command.revert(hidden).environment.showBackground).toBe(true)
  })
})

describe('the source', () => {
  it('links a sky and unlinks it back to nothing', () => {
    const command = setSource({ assetId: 'asset_1' })
    const linked = command.apply(createSkyboxContent())

    expect(linked.source).toEqual({ assetId: 'asset_1' })
    // The revert target is legitimately null here — the case a null sentinel would swallow.
    expect(command.revert(linked).source).toBeNull()
  })

  it('restores the sky that was there before, not merely nothing', () => {
    const first = setSource({ assetId: 'asset_1' }).apply(createSkyboxContent())
    const command = setSource({ assetId: 'asset_2' })

    expect(command.revert(command.apply(first)).source).toEqual({ assetId: 'asset_1' })
  })
})

describe('a command that was never applied', () => {
  it('reverts to what it was given, rather than to undefined', () => {
    const content = createSkyboxContent()
    expect(setAdjustment('exposure', 2).revert(content)).toBe(content)
  })
})
