import { describe, expect, it, vi } from 'vitest'
import { drawOverlay, RULER_SIZE, type OverlayContext, type OverlayScene } from './CanvasOverlay'

type Call = { op: string; args: unknown[] }

/**
 * A context that writes down what it was asked to draw. jsdom has no 2D context, and the point
 * of the split is exactly this: the overlay's decisions can be read back without a GPU.
 */
function recorder(): { context: OverlayContext; calls: Call[] } {
  const calls: Call[] = []
  const record =
    (op: string) =>
    (...args: unknown[]): void => {
      calls.push({ op, args })
    }

  const style = { lineWidth: 0, strokeStyle: '', fillStyle: '', font: '' }

  const context: OverlayContext = {
    save: record('save'),
    restore: record('restore'),
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    fillText: record('fillText'),
    setLineDash: record('setLineDash'),
    textAlign: 'left',
    textBaseline: 'top',
    get lineWidth() {
      return style.lineWidth
    },
    set lineWidth(value: number) {
      style.lineWidth = value
      calls.push({ op: 'lineWidth', args: [value] })
    },
    get strokeStyle() {
      return style.strokeStyle
    },
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      style.strokeStyle = String(value)
    },
    get fillStyle() {
      return style.fillStyle
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      style.fillStyle = String(value)
    },
    get font() {
      return style.font
    },
    set font(value: string) {
      style.font = value
    },
  }

  return { context, calls }
}

const COLORS = {
  frame: '#frame',
  guide: '#guide',
  rulerBackground: '#bg',
  rulerText: '#text',
  rulerTick: '#tick',
  accent: '#accent',
}

function scene(overrides: Partial<OverlayScene> = {}): OverlayScene {
  return {
    viewport: { x: 0, y: 0, scale: 1 },
    host: { width: 400, height: 300 },
    document: { width: 100, height: 100 },
    showRulers: false,
    showGuides: true,
    guides: [],
    activeGuideId: null,
    pointer: null,
    colors: COLORS,
    ...overrides,
  }
}

const opsOf = (calls: Call[], op: string): unknown[][] =>
  calls.filter(call => call.op === op).map(call => call.args)

describe('drawOverlay', () => {
  it('clears the whole host before drawing', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene())

    expect(calls[0]).toEqual({ op: 'clearRect', args: [0, 0, 400, 300] })
  })

  it('draws the document frame in screen coordinates', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene({ viewport: { x: 10, y: 20, scale: 2 } }))

    expect(opsOf(calls, 'strokeRect')).toEqual([[10.5, 20.5, 200, 200]])
  })

  // The whole reason the overlay is a second canvas: chrome does not scale with the document.
  it('keeps every stroke one pixel wide whatever the zoom', () => {
    for (const scale of [0.05, 1, 40]) {
      const { context, calls } = recorder()
      drawOverlay(context, scene({ viewport: { x: 0, y: 0, scale }, showRulers: true }))

      expect(opsOf(calls, 'lineWidth').flat()).toEqual([1])
    }
  })

  it('draws a vertical line for an x guide, across the whole host', () => {
    const { context, calls } = recorder()
    drawOverlay(
      context,
      scene({ guides: [{ id: 'g', axis: 'x', position: 40 }], viewport: { x: 5, y: 0, scale: 2 } }),
    )

    expect(opsOf(calls, 'moveTo')).toEqual([[85.5, 0]])
    expect(opsOf(calls, 'lineTo')).toEqual([[85.5, 300]])
  })

  it('draws nothing for the guides once they are hidden', () => {
    const { context, calls } = recorder()
    drawOverlay(
      context,
      scene({ showGuides: false, guides: [{ id: 'g', axis: 'x', position: 40 }] }),
    )

    expect(opsOf(calls, 'moveTo')).toEqual([])
  })

  it('leaves both ruler bands out when they are off', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene())

    expect(opsOf(calls, 'fillRect')).toEqual([])
    expect(opsOf(calls, 'fillText')).toEqual([])
  })

  it('graduates the top band in document units', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene({ showRulers: true, host: { width: 400, height: 60 } }))

    // 100% steps by 100, and the tick at 0 is hidden under the corner square.
    expect(opsOf(calls, 'fillText').map(args => args[0])).toContain('100')
    expect(opsOf(calls, 'fillText').map(args => args[0])).not.toContain('0')
  })

  it('covers the corner where the two bands meet', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene({ showRulers: true }))

    expect(opsOf(calls, 'fillRect').at(-1)).toEqual([0, 0, RULER_SIZE, RULER_SIZE])
  })

  it('hands the tool its turn before the rulers cover it', () => {
    const { context, calls } = recorder()
    const paint = vi.fn((target: OverlayContext) => target.stroke())

    drawOverlay(context, scene({ showRulers: true, paint }))

    expect(paint).toHaveBeenCalledOnce()
    const painted = calls.findIndex(call => call.op === 'stroke')
    const band = calls.findIndex(call => call.op === 'fillRect')
    expect(painted).toBeLessThan(band)
  })

  it('echoes the pointer on both rulers', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene({ showRulers: true, pointer: { x: 120, y: 90 } }))

    expect(opsOf(calls, 'moveTo')).toContainEqual([120.5, 0])
    expect(opsOf(calls, 'moveTo')).toContainEqual([0, 90.5])
  })
})
