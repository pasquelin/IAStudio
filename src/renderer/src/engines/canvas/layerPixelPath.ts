import type { LayerPixels } from './CanvasEngine'

/**
 * Where a surface's pixels sit inside the container — the full entry path, `data/…png`.
 *
 * The role goes in FRONT of the id, never behind it: a suffix would not be injective — a layer
 * literally called `x-mask` and the mask of a layer called `x` would claim the same entry, and
 * one would silently overwrite the other.
 *
 * Here rather than beside either reader: the document layer and the asset writer put the same
 * names into two different containers, and a convention spelled twice is one that drifts on the
 * day only one side is edited — the pixels then load as nothing, with no error anywhere.
 */
export const layerPixelPath = (pixels: Pick<LayerPixels, 'layerId' | 'mask'>): string =>
  `data/${pixels.mask ? 'm' : 'p'}_${pixels.layerId}.png`

/**
 * The other way round, for a read: `null` for anything that is not one of ours.
 *
 * A surface a foreign application named — `data/003.png` — answers `null` here and is placed by
 * the STACK instead, which is what says which layer it belongs to.
 */
export function layerPixelsNamed(path: string, data: Uint8Array<ArrayBuffer>): LayerPixels | null {
  const match = /^data\/([pm])_(.+)\.png$/.exec(path)
  return match?.[2] ? { layerId: match[2], mask: match[1] === 'm', data } : null
}
