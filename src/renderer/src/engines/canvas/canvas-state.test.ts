import { describe, expect, it } from 'vitest'
import { layerFixture } from './canvas-fixtures'
import {
  clampOpacity,
  DEFAULT_CANVAS,
  deserializeCanvas,
  layerById,
  serializeCanvas,
  type CanvasState,
} from './canvas-state'

const populated: CanvasState = {
  width: 800,
  height: 600,
  layers: [
    layerFixture({ id: 'a', name: 'Background', locked: true }),
    layerFixture({ id: 'b', visible: false, opacity: 0.5, blend: 'multiply' }),
  ],
  activeLayerId: 'b',
}

describe('canvas state', () => {
  it('opens with one layer, already active', () => {
    expect(DEFAULT_CANVAS.layers).toHaveLength(1)
    expect(DEFAULT_CANVAS.activeLayerId).toBe(DEFAULT_CANVAS.layers[0]?.id)
  })

  it('finds a layer by id', () => {
    expect(layerById(populated, 'b')?.name).toBe('Paint')
  })

  it('returns null for an unknown id', () => {
    expect(layerById(populated, 'nope')).toBeNull()
  })

  it('survives a serialize/deserialize round trip unchanged', () => {
    expect(deserializeCanvas(serializeCanvas(populated))).toEqual(populated)
  })

  it('falls back to a fresh document rather than throwing on unreadable input', () => {
    expect(deserializeCanvas('{ not json')).toEqual(DEFAULT_CANVAS)
  })

  it('falls back when the stored document has no layer at all', () => {
    // A canvas with an empty stack has nothing to paint on, which is worse than a fresh one.
    expect(deserializeCanvas(JSON.stringify({ width: 10, height: 10, layers: [] }))).toEqual(
      DEFAULT_CANVAS,
    )
  })

  it('picks a layer to be active when the stored one is missing', () => {
    const raw = JSON.stringify({ ...populated, activeLayerId: undefined })
    expect(deserializeCanvas(raw).activeLayerId).toBe('a')
  })
})

describe('clampOpacity', () => {
  it('keeps a value in range untouched', () => {
    expect(clampOpacity(0.4)).toBe(0.4)
  })

  it('bounds both ends', () => {
    expect(clampOpacity(-2)).toBe(0)
    expect(clampOpacity(3)).toBe(1)
  })

  it('treats an unreadable value as fully opaque', () => {
    expect(clampOpacity(Number.NaN)).toBe(1)
  })
})
