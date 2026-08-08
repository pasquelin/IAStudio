import { describe, expect, it } from 'vitest'
import {
  drawOverlay,
  RULER_SIZE,
  type OverlayContext,
  type OverlayScene,
  type ToolChrome,
} from './CanvasOverlay'

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
    // Recorded like an operation: which colour a shape was drawn in is part of what the overlay
    // decided, and reading only the geometry lets a painter draw the right box in the wrong ink.
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      style.strokeStyle = String(value)
      calls.push({ op: 'strokeStyle', args: [String(value)] })
    },
    get fillStyle() {
      return style.fillStyle
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      style.fillStyle = String(value)
      calls.push({ op: 'fillStyle', args: [String(value)] })
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
  scrim: '#scrim',
}

const NO_TOOL: ToolChrome = { crop: null, handles: null, pending: null, selection: null }

const RECT = { x: 10, y: 20, width: 30, height: 40 }

/**
 * Panned and zoomed on purpose: at 1:1 on the origin a document coordinate and a screen one are
 * the same number, and a painter that forgot to project would still read as correct.
 */
const VIEW = { x: 7, y: 11, scale: 2 }

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
    tools: NO_TOOL,
    ...overrides,
  }
}

/** The tool chrome alone: no rulers, no guides, and the frame is the first `strokeRect` of all. */
function toolScene(tools: Partial<ToolChrome>): OverlayScene {
  return scene({ showGuides: false, viewport: VIEW, tools: { ...NO_TOOL, ...tools } })
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
    const tools = { ...NO_TOOL, selection: { kind: 'rect', rect: RECT } } satisfies ToolChrome

    drawOverlay(context, scene({ showRulers: true, showGuides: false, tools }))

    const painted = calls.findIndex(call => call.op === 'stroke')
    const band = calls.findIndex(call => call.op === 'fillRect')
    expect(painted).toBeGreaterThanOrEqual(0)
    expect(painted).toBeLessThan(band)
  })

  it('echoes the pointer on both rulers', () => {
    const { context, calls } = recorder()
    drawOverlay(context, scene({ showRulers: true, pointer: { x: 120, y: 90 } }))

    expect(opsOf(calls, 'moveTo')).toContainEqual([120.5, 0])
    expect(opsOf(calls, 'moveTo')).toContainEqual([0, 90.5])
  })
})

describe('the tool chrome', () => {
  it('draws nothing of its own when no tool holds anything', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({}))

    // The document frame, and only it.
    expect(opsOf(calls, 'strokeRect')).toEqual([[7.5, 11.5, 200, 200]])
    expect(opsOf(calls, 'fillRect')).toEqual([])
    expect(opsOf(calls, 'stroke')).toEqual([])
  })

  it('closes the marquee back onto its first corner, in screen coordinates', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ selection: { kind: 'rect', rect: RECT } }))

    expect(opsOf(calls, 'moveTo')).toEqual([[27.5, 51.5]])
    expect(opsOf(calls, 'lineTo')).toEqual([
      [87.5, 51.5],
      [87.5, 131.5],
      [27.5, 131.5],
      [27.5, 51.5],
    ])
  })

  it('dashes the marquee and puts the dash back for whoever draws next', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ selection: { kind: 'rect', rect: RECT } }))

    expect(opsOf(calls, 'setLineDash')).toEqual([[[]], [[4, 4]], [[]]])
  })

  it('leaves a lasso of no point alone', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ selection: { kind: 'lasso', points: [] } }))

    expect(opsOf(calls, 'stroke')).toEqual([])
    expect(opsOf(calls, 'setLineDash')).toEqual([[[]]])
  })

  it('outlines the shape under the hand without dashing it', () => {
    const { context, calls } = recorder()
    drawOverlay(
      context,
      toolScene({ pending: { kind: 'line', from: { x: 10, y: 20 }, to: { x: 40, y: 60 } } }),
    )

    expect(opsOf(calls, 'moveTo')).toEqual([[27.5, 51.5]])
    expect(opsOf(calls, 'lineTo')).toEqual([
      [87.5, 131.5],
      [27.5, 51.5],
    ])
    expect(opsOf(calls, 'setLineDash')).toEqual([[[]]])
  })

  it('asks for no path at all for a shape with no vertex', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ pending: { kind: 'polygon', points: [] } }))

    expect(opsOf(calls, 'beginPath')).toEqual([])
  })

  it('dims the four bands the crop would cut, then frames and grips what it keeps', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ crop: RECT }))

    const fills = opsOf(calls, 'fillRect')
    expect(fills.slice(0, 4)).toEqual([
      [7, 11, 200, 40],
      [7, 131, 200, 80],
      [7, 51, 20, 80],
      [87, 51, 120, 80],
    ])
    // Eight grips, not nine: a crop does not turn the document.
    expect(fills).toHaveLength(12)
    expect(opsOf(calls, 'strokeRect')).toContainEqual([27.5, 51.5, 60, 80])
  })

  it('dims in the scrim colour and grips in the accent one', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ crop: RECT }))

    expect(opsOf(calls, 'fillStyle')).toEqual([['#scrim'], ['#accent']])
    expect(opsOf(calls, 'strokeStyle').at(-1)).toEqual(['#accent'])
  })

  it('offers nine grips on the armed layer, the ninth above it to turn it by', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ handles: RECT }))

    const fills = opsOf(calls, 'fillRect')
    expect(fills).toHaveLength(9)
    // North-west corner: (10,20) projected, then backed off by half the grip size.
    expect(fills[0]).toEqual([21.5, 45.5, 12, 12])
    // The rotate grip is offset in document units, so its 24 reads as 48 at twice the zoom.
    expect(fills.at(-1)).toEqual([51.5, -2.5, 12, 12])
  })

  it('paints the crop before the grips, so the dimming never lands on top of one', () => {
    const { context, calls } = recorder()
    drawOverlay(context, toolScene({ crop: RECT, handles: RECT }))

    const fills = opsOf(calls, 'fillRect')
    // Twelve for the crop — four bands and eight grips — then the layer's own nine.
    expect(fills).toHaveLength(21)
    expect(fills[0]).toEqual([7, 11, 200, 40])
    // Only the move tool offers a rotate grip, so its arriving last places the whole group last.
    expect(fills.at(-1)).toEqual([51.5, -2.5, 12, 12])
  })
})
