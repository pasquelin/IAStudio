/**
 * `@mdi/js` glyphs on a 2D canvas — the two things every caller needs before it can draw one.
 *
 * Two surfaces draw them: the bitmap a native menu row wants (`menuIcon`) and the mark a clip
 * wears on the timeline (`engines/timeline/painter`). They had the same constant under the same
 * sentence and the same three lines of scale-and-fill, in files neither of which knows the other
 * exists — which is the state a drift starts from.
 */

/** The box every `@mdi/js` path is drawn in. */
export const MDI_VIEWBOX = 24

const built = new Map<string, Path2D>()

/**
 * A glyph's `d` string as a `Path2D`, built once per glyph.
 *
 * The strip repaints at every frame of a drag and every clip may carry a mark, where an mdi path
 * is several hundred characters to parse: at five hundred clips that is the frame budget on its
 * own. `Path2D` takes the very same string `UiIcon` renders, which is what keeps a painted glyph
 * and the menu row beside it from becoming two drawings of the same idea.
 */
export function mdiPath(d: string): Path2D {
  const known = built.get(d)
  if (known) return known

  const path = new Path2D(d)
  built.set(d, path)
  return path
}
