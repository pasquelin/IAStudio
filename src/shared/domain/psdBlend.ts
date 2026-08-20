/**
 * The studio's compositing operations, as Photoshop spells them.
 *
 * ORA needed no table at all — `svg:multiply` is the studio's own name with a prefix, the two
 * having taken theirs from the same CSS list. PSD did not: its file carries four-character codes,
 * and `ag-psd` turns them into words of its own before anything here sees them.
 *
 * The difference is punctuation and nothing else, for the twelve that both sides hold — a hyphen
 * here, a space there. It is written out all the same rather than derived from a replace: PSD has
 * nineteen operations this studio has none of, and a rule would answer confidently for every one.
 */

import { BLEND_MODES, type BlendMode } from './canvasBlend'

/** What Photoshop calls each of the studio's sixteen. */
const PSD_NAME: Record<BlendMode, string> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color dodge',
  'color-burn': 'color burn',
  'hard-light': 'hard light',
  'soft-light': 'soft light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
}

export const psdBlendOf = (blend: BlendMode): string => PSD_NAME[blend]

/**
 * The studio's operation for one of Photoshop's, or `normal` for the nineteen it has no answer
 * for — `dissolve`, `vivid light`, `hard mix` and the rest.
 *
 * Falling back rather than refusing the layer, and that is the trade: the pixels arrive and
 * compose PLAINLY, where refusing would lose them entirely. What is lost is said by the registry
 * before the click, never discovered by comparing two screens afterwards.
 */
export function blendFromPsd(name: string | undefined): BlendMode {
  return BLEND_MODES.find(blend => PSD_NAME[blend] === name) ?? 'normal'
}

/** Whether Photoshop's operation is one the studio composes, which is what the notice asks. */
export const composesInStudio = (name: string | undefined): boolean =>
  BLEND_MODES.some(blend => PSD_NAME[blend] === name)
