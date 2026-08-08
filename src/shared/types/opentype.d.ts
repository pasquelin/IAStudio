/**
 * The surface of `opentype.js` the studio uses. The package ships no types of its own, and the
 * ones on DefinitelyTyped describe its previous major — so what the studio calls is declared
 * here, narrowly: a declaration nobody can drift from is worth more than a complete one.
 *
 * Under `shared/` because both TypeScript projects have to see it, and this is the one folder
 * they both include. It is a declaration and nothing else: `shared/` still imports nothing at
 * runtime, and only the renderer ever calls this library — save for the one test that proves the
 * three shipped faces really parse, which needs a filesystem and therefore runs on the node side.
 *
 * Only outlines are wanted. `TextGeometry` needs a font in three.js's own typeface format, which
 * no project asset is and which the studio ships none of; the glyph paths this hands back are
 * turned into shapes and extruded directly — see `engines/scene/text-geometry`.
 */
declare module 'opentype.js' {
  /**
   * A glyph contour, in font units scaled to the size asked for. `y` grows downward, as it does
   * on a screen and unlike everything in a three.js scene.
   */
  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' }

  export type Path = { commands: PathCommand[] }

  export type Font = {
    /** The grid the outlines were drawn on — what turns font units into the size asked for. */
    unitsPerEm: number
    ascender: number
    descender: number
    /** The outlines of a run, with `y` the baseline. Kerned, as the face itself asks. */
    getPath(text: string, x: number, y: number, fontSize: number): Path
    getAdvanceWidth(text: string, fontSize: number): number
  }

  /** Throws on anything that is not a font it reads — a collection included. */
  export function parse(buffer: ArrayBuffer): Font
}
