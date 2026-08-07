import {
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusKnotGeometry,
  type BufferGeometry,
} from 'three'
import type { PreviewShape } from './texture-state'

/**
 * How finely a preview shape is cut. Flat by default and subdivided only when a height map is
 * actually displacing it: 128 × 128 is thirty-two thousand triangles, and a sphere carrying
 * that for a texture with no relief costs more than the 3D scene it is meant to preview.
 */
const SEGMENTS = { flat: 32, displaced: 128 }

/**
 * The shapes a texture is judged on. A plane reads tiling, a sphere reads lighting, and a knot
 * shows how the map behaves where the surface turns on itself.
 *
 * Every one of them carries a second UV set: ambient occlusion reads `uv1`, and a preview
 * without it would show an AO map doing nothing at all.
 */
export function previewGeometry(shape: PreviewShape, displaced: boolean): BufferGeometry {
  const segments = displaced ? SEGMENTS.displaced : SEGMENTS.flat
  const geometry = build(shape, segments)

  const uv = geometry.getAttribute('uv')
  if (uv) geometry.setAttribute('uv1', uv)
  return geometry
}

function build(shape: PreviewShape, segments: number): BufferGeometry {
  switch (shape) {
    case 'sphere':
      return new SphereGeometry(1, segments, segments)
    case 'box':
      return new BoxGeometry(1.4, 1.4, 1.4, segments, segments, segments)
    case 'cylinder':
      return new CylinderGeometry(0.8, 0.8, 1.8, segments, Math.max(1, segments / 4))
    case 'plane':
      return new PlaneGeometry(2, 2, segments, segments)
    case 'torusKnot':
      return new TorusKnotGeometry(0.7, 0.26, segments * 2, segments / 2)
  }
}
