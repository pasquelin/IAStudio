import { ExtrudeGeometry, ShapePath, type BufferGeometry, type Shape } from 'three'
import type { Font, PathCommand } from 'opentype.js'
import type { TextDescriptor } from '@shared/domain/scene'

/**
 * Letters, as geometry.
 *
 * three.js ships `TextGeometry`, and it is not used: it reads a font in three's own typeface JSON
 * format, which no project asset is and which the studio ships none of. Its own `TTFLoader` would
 * convert one, but it fetches `opentype.js` from a CDN — forbidden by the window's policy, and
 * against the promise that nothing here needs the network. So the outlines come straight from
 * `opentype.js` and are extruded directly, which is all `TextGeometry` does anyway.
 *
 * The whole run is turned into shapes at once rather than glyph by glyph: `getPath` kerns the
 * pairs as the face asks, and laying out the advances by hand would throw that away.
 */

/**
 * The contours of a run, in three's frame. `opentype.js` draws with `y` growing downward, as a
 * screen does and as nothing in a scene does — every point is flipped on the way in.
 *
 * Holes come out as holes: `ShapePath.toShapes` decides nesting by point-in-polygon rather than
 * by winding, so the counter of an `o` is found whichever way the face happens to wind it.
 */
export function textShapes(font: Font, value: string, size: number): Shape[] {
  const path = new ShapePath()

  for (const command of font.getPath(value, 0, 0, size).commands) {
    trace(path, command)
  }

  return path.toShapes()
}

function trace(path: ShapePath, command: PathCommand): void {
  switch (command.type) {
    case 'M':
      path.moveTo(command.x, -command.y)
      return
    case 'L':
      path.lineTo(command.x, -command.y)
      return
    case 'Q':
      path.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y)
      return
    case 'C':
      path.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y)
      return
    case 'Z':
      // Closed rather than left open: an unclosed contour is a polygon whose last edge is missing,
      // and that edge is exactly what the point-in-polygon test walks to find a counter.
      path.currentPath?.closePath()
  }
}

/**
 * The run as a solid, centred across its width and its thickness while its baseline stays on the
 * node's own origin — so a text sits on the grid it was dropped onto, and typing a descender does
 * not make what is already written jump.
 */
export function textGeometry(font: Font, text: TextDescriptor): BufferGeometry {
  const shapes = textShapes(font, text.value, text.size)

  const geometry = new ExtrudeGeometry(shapes, {
    depth: text.depth,
    curveSegments: text.curveSegments,
    bevelEnabled: false,
  })

  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  // An empty run has an empty box, whose ends are the two infinities: centring on it would write
  // a NaN into the bounding box every framing and every gizmo then reads.
  if (bounds && !bounds.isEmpty()) {
    geometry.translate(-(bounds.min.x + bounds.max.x) / 2, 0, -text.depth / 2)
  }

  return geometry
}
