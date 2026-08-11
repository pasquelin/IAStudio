import { embeddedFontOf, embeddedFontUrl, type FontRef } from '@shared/domain/font'
import { layerById, type CanvasState, type TextLayer } from './canvas-state'

/**
 * What a canvas needs of a typeface, which is not what the 3D workspace needs of the same one.
 *
 * A scene extrudes glyph outlines; a canvas hands a family name to the browser and lets it
 * rasterize. So the two share the reference a document stores and the list a picker offers — see
 * `domain/font` — and nothing else: a face parsed into paths is no use to `Text`, and a face
 * registered with the page is no use to `ExtrudeGeometry`.
 */

/** Registers a face with the page under a family name. Injected: jsdom has no `FontFace`. */
export type FaceRegistrar = (family: string, url: string) => Promise<void>

/**
 * The CSS stack a caption is drawn with: the family itself, then a generic to fall back on.
 *
 * Quoted, because a family name is a sentence — "IBM Plex Serif" unquoted reads as three names.
 * The generic is what draws while an embedded face is still being registered, and what draws for
 * good on a machine that has not got a system one.
 */
export function familyStack(font: FontRef): string {
  // The quote is escaped rather than trusted: the family comes from a font file the studio did
  // not write, and one holding a quote would close the declaration and take the generic with it.
  return `"${font.family.replaceAll('"', '\\"')}", sans-serif`
}

/**
 * The file an embedded face has to be registered from, or `null` when there is nothing to do —
 * a system face is one the browser already resolves by name.
 */
export function faceUrlOf(font: FontRef): string | null {
  if (font.source !== 'embedded') return null

  const embedded = embeddedFontOf(font.family)
  return embedded ? embeddedFontUrl(embedded.file) : null
}

/**
 * The caption still worth redrawing now that a face has landed, or `null` when it has moved on.
 *
 * Read out of the state rather than closed over: the layer may have been retyped in another face
 * or deleted entirely while the file was on its way, and what the document holds now is what
 * decides. Decided here rather than in the engine so that every way it can go is a plain test.
 *
 * Filed in a group, a caption used to be missed entirely and stayed in the generic until someone
 * edited it: `drawText` only redraws a wording that changed.
 */
export function captionSetIn(
  state: CanvasState | null,
  id: string,
  family: string,
): TextLayer | null {
  if (!state) return null

  // The family alone, not `isSameFont`: a face is registered with the page under a family name,
  // so a caption moved from the shipped Lato to an installed one is drawn by the face that landed.
  const found = layerById(state, id)
  if (found?.kind !== 'text' || found.font.family !== family) return null

  return found
}

/** Registers a face with the page. The one place `FontFace` is named, and it is not testable. */
export const registerFace: FaceRegistrar = async (family, url) => {
  const face = new FontFace(family, `url(${url})`)
  await face.load()
  document.fonts.add(face)
}
