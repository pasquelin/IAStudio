import type { LayerPixels } from './CanvasEngine'

/**
 * What a surface's pixels are called, in a document folder and inside a container alike.
 *
 * The role goes in FRONT of the id, never behind it: a suffix would not be injective — a layer
 * literally called `x-mask` and the mask of a layer called `x` would claim the same file, and one
 * would silently overwrite the other.
 *
 * Here rather than beside either reader: the two write the same names into two different places,
 * and a convention spelled twice is one that drifts on the day only one side is edited — the
 * pixels then load as nothing, with no error anywhere.
 */
export const layerPixelName = (pixels: LayerPixels): string =>
  `${pixels.mask ? 'm' : 'p'}_${pixels.layerId}.png`

/** The other way round, for a read: `null` for anything that is not one of ours. */
export function layerPixelsNamed(name: string, data: string): LayerPixels | null {
  const match = /^([pm])_(.+)\.png$/.exec(name)
  return match?.[2] ? { layerId: match[2], mask: match[1] === 'm', data } : null
}
