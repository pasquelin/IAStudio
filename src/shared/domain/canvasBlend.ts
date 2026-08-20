/**
 * How a layer composites onto what is under it.
 *
 * Under `shared/` because three sides need the same list and had grown two: the canvas engine
 * declared it, and `canvasActions` restated it as bare strings for the assistant's field — so a
 * mode added to one was offered by the other and composed by neither.
 *
 * The names are CSS's `mix-blend-mode`, which is what makes the ORA mapping a prefix and nothing
 * more (`svg:multiply`). Photoshop spells its own; `psdBlend.ts` is that table.
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]

/**
 * An OpenRaster `composite-op` back to a blend this studio knows — `svg:multiply` is `multiply`,
 * and anything the union does not hold falls back to `normal`.
 *
 * Here rather than beside either reader: two modules had written it, one narrowing against the
 * union and one CASTING — and the casting one fed `psdBlend`, where a value outside the union
 * becomes `undefined` and is handed to `ag-psd` as a blend mode. The fallback is the one
 * `blendFromPsd` already applies coming the other way.
 */
export function blendOfComposite(composite: string): BlendMode {
  const name = composite.replace(/^svg:/, '')
  return BLEND_MODES.find(mode => mode === name) ?? 'normal'
}
