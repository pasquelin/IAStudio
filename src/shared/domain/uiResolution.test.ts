import { describe, expect, it } from 'vitest'
import { DESIGN_RESOLUTION } from './ui'
import { UI_RESOLUTIONS, UI_RESOLUTION_IDS, isUiResolutionId, uiResolutionOf } from './uiResolution'

describe('the canvases an interface is drawn at', () => {
  it('names the preset a document is at, and calls anything else free', () => {
    expect(uiResolutionOf(DESIGN_RESOLUTION)).toBe('desktopHd')
    expect(uiResolutionOf({ width: 1280, height: 720 })).toBe('desktop720')
    expect(uiResolutionOf({ width: 1234, height: 567 })).toBe('free')
  })

  /** Both ways round: an id nobody measured, and a size nobody named. */
  it('answers for every id it publishes', () => {
    expect(Object.keys(UI_RESOLUTIONS).sort()).toEqual([...UI_RESOLUTION_IDS].sort())
    expect(UI_RESOLUTIONS.free).toBeNull()
  })

  it('turns away an id read back from somewhere else', () => {
    expect(isUiResolutionId('desktopHd')).toBe(true)
    expect(isUiResolutionId('retina')).toBe(false)
  })
})
