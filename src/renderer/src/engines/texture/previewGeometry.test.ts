import { describe, expect, it } from 'vitest'
import { PREVIEW_SHAPES } from './textureState'
import { previewGeometry } from './previewGeometry'

describe('previewGeometry', () => {
  it('builds every shape the preview offers', () => {
    for (const shape of PREVIEW_SHAPES) {
      const geometry = previewGeometry(shape, false)
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
      geometry.dispose()
    }
  })

  // Ambient occlusion reads the second UV set, which no primitive carries on its own: without
  // it, ticking an AO map would do nothing at all.
  it('gives every shape the second UV set ambient occlusion reads', () => {
    for (const shape of PREVIEW_SHAPES) {
      const geometry = previewGeometry(shape, false)
      expect(geometry.getAttribute('uv1')).toBeDefined()
      geometry.dispose()
    }
  })

  // A sphere carrying thirty-two thousand triangles for a texture with no relief costs more
  // than the 3D scene it is meant to preview.
  it('only subdivides when a height map is displacing the surface', () => {
    const flat = previewGeometry('sphere', false)
    const displaced = previewGeometry('sphere', true)

    expect(displaced.getAttribute('position').count).toBeGreaterThan(
      flat.getAttribute('position').count,
    )

    flat.dispose()
    displaced.dispose()
  })
})
