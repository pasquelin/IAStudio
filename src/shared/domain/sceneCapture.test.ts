import { describe, expect, it } from 'vitest'
import { captureSize } from './sceneCapture'

describe('captureSize', () => {
  it('takes the panel it stands in, pixel for pixel, at the view quality', () => {
    expect(captureSize({ width: 1234, height: 567 }, 'view')).toEqual({
      width: 1234,
      height: 567,
    })
  })

  it('keeps the framing when it raises the definition', () => {
    expect(captureSize({ width: 800, height: 400 }, 'fullHd')).toEqual({
      width: 2160,
      height: 1080,
    })
  })

  it('answers on a panel that has not been laid out yet, rather than nothing at all', () => {
    expect(captureSize({ width: 0, height: 0 }, 'ultraHd')).toEqual({ width: 3840, height: 2160 })
  })

  // The one the keyboard command takes: reading the height of a panel that has none wrote a
  // picture one pixel tall into the project, and nothing said so.
  it('falls back to a full picture at the view quality too, not to a single pixel', () => {
    expect(captureSize({ width: 0, height: 0 }, 'view')).toEqual({ width: 1920, height: 1080 })
  })
})
