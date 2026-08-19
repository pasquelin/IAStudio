import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three'

/**
 * What a camera and a light are DRAWN as. The name is what keeps a marker out of an export, off
 * a preview, and out of the triangle count somebody reads to judge their own model.
 */
export const MARKER_NAME = 'workshop-marker'

/** How much lighter a face turned up is, and how much darker one turned down — of its lightness. */
const FACE_LIGHT = 1.3
const FACE_DARK = 0.62
const FACE_SIDE = 0.85

/**
 * A part of a marker: a solid SHADED by the way its faces point, plus the edges that outline it.
 *
 * A box takes its six faces in three's own order (+X, −X, +Y, −Y, +Z, −Z) and a cylinder takes
 * three (side, top, bottom); anything else takes one and leans on its edges.
 */
export function solid(geometry: BufferGeometry, fill: string, edge: string): Mesh {
  const faces = shadedFaces(geometry, fill)
  const mesh = new Mesh(geometry, faces.length === 1 ? faces[0] : faces)
  mesh.add(new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: edge })))
  return mesh
}

function shadedFaces(geometry: BufferGeometry, fill: string): MeshBasicMaterial[] {
  const shade = (amount: number): MeshBasicMaterial =>
    new MeshBasicMaterial({ color: dimmed(fill, amount) })

  if (geometry instanceof BoxGeometry) {
    return [
      shade(1),
      shade(FACE_SIDE),
      shade(FACE_LIGHT),
      shade(FACE_DARK),
      shade(1),
      shade(FACE_SIDE),
    ]
  }
  if (geometry instanceof CylinderGeometry) return [shade(1), shade(FACE_LIGHT), shade(FACE_DARK)]
  return [shade(1)]
}

/**
 * In sRGB, the space the colour was picked in. Done in the working space instead, the transfer
 * curve moves the hue and flattens the saturation: #ff8000 came back #ffaa86, a salmon.
 */
function relit(colour: string, shade: (lightness: number) => number): Color {
  const hsl = { h: 0, s: 0, l: 0 }
  const held = new Color(colour)
  held.getHSL(hsl, SRGBColorSpace)
  return held.setHSL(hsl.h, hsl.s, shade(hsl.l), SRGBColorSpace)
}

/** A share of the lightness, for the relief of a marker painted by face orientation. */
function dimmed(colour: string, amount: number): Color {
  return relit(colour, lightness => Math.min(1, lightness * amount))
}

/**
 * A lamp's own colour, brought up to where it can be SEEN. An ambient light ships at #222222 and
 * a bulb painted with it is a black ball on a dark viewport — the colour still says which lamp
 * this is, the lightness only says that there is one.
 */
export function lit(colour: string): Color {
  return relit(colour, lightness => Math.max(lightness, 0.62))
}
