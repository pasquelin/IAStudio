import { describe, expect, it } from 'vitest'
import { cropChrome, cropRect, resizeCrop } from './crop'

const DOCUMENT = { width: 800, height: 600 }
const VIEW_1_1 = { x: 0, y: 0, scale: 1 }

describe('cropRect', () => {
  it('frames the box between the two points', () => {
    expect(cropRect({ x: 100, y: 50 }, { x: 300, y: 250 }, DOCUMENT, false)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 200,
    })
  })

  it('frames the same box when the drag runs backwards', () => {
    expect(cropRect({ x: 300, y: 250 }, { x: 100, y: 50 }, DOCUMENT, false)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 200,
    })
  })

  it('squares the frame when the drag is constrained', () => {
    const rect = cropRect({ x: 0, y: 0 }, { x: 300, y: 100 }, DOCUMENT, true)
    expect(rect).toEqual({ x: 0, y: 0, width: 300, height: 300 })
  })

  /**
   * Cropping is a trim, so the frame never leaves the picture: a drag that runs off the canvas
   * would otherwise grow the document, filling the new room with nothing at all.
   */
  it('clamps a drag that runs off the document', () => {
    expect(cropRect({ x: -200, y: -100 }, { x: 2000, y: 2000 }, DOCUMENT, false)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    })
  })

  it('clamps a constrained drag too, which stops it being square', () => {
    // What the overlay draws comes through here as well, so the chrome shows the clipped frame
    // rather than promising a square the crop will not deliver.
    expect(cropRect({ x: 700, y: 0 }, { x: 1100, y: 400 }, DOCUMENT, true)).toEqual({
      x: 700,
      y: 0,
      width: 100,
      height: 400,
    })
  })

  it('rounds to whole pixels', () => {
    expect(cropRect({ x: 10.4, y: 10.6 }, { x: 100.5, y: 100.5 }, DOCUMENT, false)).toEqual({
      x: 10,
      y: 11,
      width: 91,
      height: 90,
    })
  })

  it('refuses a click, which would crop the document down to one pixel', () => {
    expect(cropRect({ x: 100, y: 100 }, { x: 100, y: 100 }, DOCUMENT, false)).toBeNull()
  })

  it('refuses a drag thinner than a pixel on either axis', () => {
    expect(cropRect({ x: 100, y: 100 }, { x: 100.4, y: 300 }, DOCUMENT, false)).toBeNull()
    expect(cropRect({ x: 100, y: 100 }, { x: 300, y: 100.4 }, DOCUMENT, false)).toBeNull()
  })

  it('refuses a drag that happens entirely outside the document', () => {
    expect(cropRect({ x: 900, y: 700 }, { x: 1200, y: 900 }, DOCUMENT, false)).toBeNull()
  })
})

describe('resizeCrop', () => {
  const FRAME = { x: 100, y: 100, width: 200, height: 200 }

  it('moves the edge its grip pulls and leaves the others alone', () => {
    expect(resizeCrop(FRAME, 'e', { x: 400, y: 999 }, DOCUMENT, false)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    })
  })

  it('moves both edges of a corner grip', () => {
    expect(resizeCrop(FRAME, 'nw', { x: 50, y: 60 }, DOCUMENT, false)).toEqual({
      x: 50,
      y: 60,
      width: 250,
      height: 240,
    })
  })

  it('keeps the opposite edge fixed when a grip is dragged inwards', () => {
    expect(resizeCrop(FRAME, 'w', { x: 250, y: 0 }, DOCUMENT, false)).toEqual({
      x: 250,
      y: 100,
      width: 50,
      height: 200,
    })
  })

  /** Pulled past the far edge the frame flips rather than inverting: `box` normalises it. */
  it('flips the frame when a grip is dragged past the opposite edge', () => {
    expect(resizeCrop(FRAME, 'w', { x: 500, y: 0 }, DOCUMENT, false)).toEqual({
      x: 300,
      y: 100,
      width: 200,
      height: 200,
    })
  })

  it('clamps an adjusted frame to the document, as a dragged one is', () => {
    expect(resizeCrop(FRAME, 'se', { x: 2000, y: 2000 }, DOCUMENT, false)).toEqual({
      x: 100,
      y: 100,
      width: 700,
      height: 500,
    })
  })

  it('refuses an adjustment that collapses the frame', () => {
    expect(resizeCrop(FRAME, 'w', { x: 300, y: 0 }, DOCUMENT, false)).toBeNull()
  })
})

describe('cropChrome', () => {
  const FRAME = { x: 100, y: 50, width: 200, height: 100 }

  it('dims the four bands of the document the drop would cut away', () => {
    const { scrim } = cropChrome(FRAME, VIEW_1_1, DOCUMENT)

    expect(scrim).toEqual([
      { x: 0, y: 0, width: 800, height: 50 },
      { x: 0, y: 150, width: 800, height: 450 },
      { x: 0, y: 50, width: 100, height: 100 },
      { x: 300, y: 50, width: 500, height: 100 },
    ])
  })

  /**
   * A band of no area is a fill of nothing. Kept out rather than drawn, so a frame that keeps
   * the whole document dims none of it — which is what says "this crop costs nothing".
   */
  it('dims nothing when the frame keeps the whole document', () => {
    const whole = { x: 0, y: 0, width: 800, height: 600 }
    expect(cropChrome(whole, VIEW_1_1, DOCUMENT).scrim).toEqual([])
  })

  it('drops only the empty bands when the frame touches one edge', () => {
    const flush = { x: 0, y: 50, width: 800, height: 100 }
    expect(cropChrome(flush, VIEW_1_1, DOCUMENT).scrim).toEqual([
      { x: 0, y: 0, width: 800, height: 50 },
      { x: 0, y: 150, width: 800, height: 450 },
    ])
  })

  it('offsets the frame by half a pixel, so its hairline stays one pixel wide', () => {
    expect(cropChrome(FRAME, VIEW_1_1, DOCUMENT).frame).toEqual({
      x: 100.5,
      y: 50.5,
      width: 200,
      height: 100,
    })
  })

  it('puts eight grips on the frame, and no rotate grip — a crop does not turn', () => {
    const { grips } = cropChrome(FRAME, VIEW_1_1, DOCUMENT)

    expect(grips).toHaveLength(8)
    // The north-west grip, centred on the corner: 4 px of square either side of x = 100.
    expect(grips[0]).toEqual({ x: 96.5, y: 46.5, width: 8, height: 8 })
    // None of them sits above the frame, which is where a rotate grip would be.
    expect(grips.every(grip => grip.y >= 46.5)).toBe(true)
  })

  /**
   * Chrome never scales: a grip that shrank with the zoom would be unreadable on a document seen
   * at 5%, and the scrim has to follow the picture rather than the document's own units.
   */
  it('follows the viewport without scaling the grips', () => {
    const zoomed = cropChrome(FRAME, { x: 10, y: 20, scale: 2 }, DOCUMENT)

    expect(zoomed.frame).toEqual({ x: 210.5, y: 120.5, width: 400, height: 200 })
    expect(zoomed.grips[0]).toEqual({ x: 206.5, y: 116.5, width: 8, height: 8 })
  })
})
