/**
 * A material as MaterialX 1.39 holds one, and back.
 *
 * **Conformance here is read against the TEXT of the specification and against the `.mtlx` files
 * the distribution ships — never against a rendering.** No MaterialX reader is installed on this
 * machine and none will be, so what is claimed below is what the spec says, not what was seen.
 *
 * The split is the one OpenRaster and glTF already draw: the standard part is what ANOTHER
 * application reads — `standard_surface` fed by `tiledimage` nodes — and the studio's own state
 * rides verbatim in a custom attribute, which § "Custom Attributes and Inputs" both permits and
 * requires a reader to preserve. Reopening a file of ours is then one pass over that attribute,
 * and no rule is kept in step on two sides.
 */

import { isRecord } from '../guards'

export const MTLX_VERSION = '1.39'

/**
 * Element and attribute names are ASCII letters, digits and `_` only, never a dot — § MaterialX
 * Names. So `scenariostate`, where OTIO writes `metadata.scenario` and glTF an `extras` member.
 */
export const MTLX_STUDIO_ATTR = 'scenariostate'

/** The envelope, written BEFORE the state so a bounded head read reaches it whatever the state weighs. */
export const MTLX_ENVELOPE_ATTR = 'scenariodocument'

/**
 * How much of a `.mtlx` is read to find its envelope. Larger than an OpenRaster head because the
 * XML declaration and the whole `<materialx>` open tag share the first line with it.
 */
export const MTLX_HEAD_LIMIT = 16 * 1024

/** The colour space the spec names for a map authored as colour. Data maps carry none. */
export const MTLX_SRGB = 'srgb_texture'

/**
 * The space every colour VALUE in the file is written in, declared on the root as the
 * distribution's own examples declare it. Without it a `color3` value has no stated space and
 * each reader picks one — which is a different material in every application that opens it.
 */
export const MTLX_COLORSPACE = 'lin_rec709'

/**
 * The types this studio WRITES. A type read back off a file is kept as the file spelt it — a
 * `vector3`, a `boolean`, a `matrix33` — because re-deriving one from the shape of the value gets
 * it wrong: `normal` and `tangent` are `vector3` and would come back `color3`.
 */
export type MtlxType = 'color3' | 'float' | 'vector3'

/**
 * The node an image passes through before it reaches the surface. `normalmap` carries `in` and
 * `scale`; `displacement` carries `displacement` and `scale` and yields a `displacementshader`,
 * which is why the height map lands on the MATERIAL and not on the shader.
 */
export type MtlxWrap = { node: 'normalmap' | 'displacement'; scale: number }

/** A `tiledimage` reading one file, and where its result lands. */
export type MtlxImage = {
  /** The `standard_surface` input it feeds, or `displacementshader` on the `surfacematerial`. */
  input: string
  /** As the file spelt it. This studio writes one of `MtlxType`; a file may say anything. */
  type: string
  /** Project-relative, as the file spells it — an asset id would name nothing anywhere else. */
  file: string
  colorspace?: string
  /** `uvtiling` and `uvoffset`, which `tiledimage` carries and plain `image` does not. */
  tiling: readonly [number, number]
  offset: readonly [number, number]
  wrap?: MtlxWrap
  /** A tint multiplied over the image, written as a `<multiply>` between the two. */
  multiply?: readonly [number, number, number]
}

/**
 * A uniform value on an input — what a channel carrying no map writes instead of an image, and
 * what an input from another application is carried across as.
 *
 * `value` keeps a STRING when the file's own spelling is not numeric: `thin_walled="true"` and
 * every enumerated input would otherwise be dropped on the floor by a numeric parse.
 */
export type MtlxValue = {
  input: string
  type: string
  value: number | readonly number[] | string
}

/**
 * What the window composes and the main process spells. `studio` is absent on a file from
 * anywhere else, and that absence is exactly what says to rebuild from the standard part alone.
 */
export type MtlxDocument = {
  images: readonly MtlxImage[]
  values: readonly MtlxValue[]
  studio?: Record<string, unknown>
  /**
   * Element kinds the file holds that this studio does not compose — a second material, a `look`,
   * a `nodedef`. Set only when there are any, and read by the window to REFUSE a save: rewriting
   * such a file from one material would delete the rest of it.
   */
  extra?: readonly string[]
}

/**
 * The `standard_surface` inputs this studio composes, and the only ones a save writes back.
 *
 * **The refusal has to bite at the INPUT, not only at the element** — that is where enrichment
 * actually arrives. `standard_surface` is an element this studio composes, so an element-grained
 * check reads a file carrying `coat`, `specular` and `transmission` as safe to rewrite, and ⌘S
 * deletes all three without a word. Measured on the distribution's own brass example.
 */
export const MTLX_STUDIO_INPUTS: readonly string[] = [
  'base_color',
  'specular_roughness',
  'metalness',
  'normal',
  'emission',
  'emission_color',
]

/** What a file this studio writes is made of. Anything else in one came from somewhere else. */
export const MTLX_COMPOSED: readonly string[] = [
  'materialx',
  'nodegraph',
  'tiledimage',
  'image',
  'input',
  'output',
  'normalmap',
  'multiply',
  'displacement',
  'standard_surface',
  'surfacematerial',
]

export function isMtlxDocument(value: unknown): value is MtlxDocument {
  return isRecord(value) && Array.isArray(value.images) && Array.isArray(value.values)
}

/** What rides under the studio's own attribute, or nothing — never a partial object. */
export function mtlxStudioState(document: MtlxDocument): Record<string, unknown> {
  return isRecord(document.studio) ? document.studio : {}
}

/**
 * The inputs of `standard_surface` this studio writes, checked against
 * `MaterialX.PBRSpec.md` § standard_surface. **There is no ambient-occlusion and no cavity input
 * in that table** — which is why two of the studio's eight channels cannot be carried at all.
 */
export const MTLX_BASE_COLOR = 'base_color'
export const MTLX_ROUGHNESS = 'specular_roughness'
export const MTLX_METALNESS = 'metalness'
export const MTLX_NORMAL = 'normal'
export const MTLX_EMISSION = 'emission'
export const MTLX_EMISSION_COLOR = 'emission_color'
export const MTLX_DISPLACEMENT = 'displacementshader'
