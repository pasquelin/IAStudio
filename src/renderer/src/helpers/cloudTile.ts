import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloudAsset'
import { assetIcon } from '@/helpers/workspaces'

/**
 * How many pixels to ask the CDN for, from the width the tile occupies on screen in CSS pixels.
 *
 * Two measurements, both taken against the account on 16 August 2026, and each one closes a way
 * of getting this wrong:
 *
 * `width=` is honoured exactly — 220 answers 220 px, 440 answers 440. So the number to send is
 * the one the screen will actually draw, and nothing has to be guessed: the CSS width times the
 * display's density.
 *
 * Asking for MORE than the asset holds upsamples rather than refusing — a 1104 px picture
 * answers `width=2208` with a soft 2208 px one, for a megabyte instead of 786 ko. Its own width
 * is therefore the ceiling, and softness is what a tile shows when nobody sets one.
 *
 * The density is rounded UP to a whole number so a tile asks for one of two or three widths ever
 * rather than one per machine: Windows scaling reports ratios like 1.5, and a fractional width
 * would mint a URL no other session shares — the CDN builds each new one on first demand, and
 * answers a redirect in the meantime.
 */
function askedWidth(cssWidth: number, assetWidth: number | undefined): number {
  const density = Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1))
  const wanted = cssWidth * density
  return assetWidth === undefined ? wanted : Math.min(wanted, assetWidth)
}

/**
 * What an asset of the account shows on a tile, wherever the tile is drawn — the library panel,
 * the similar band, the explore band.
 *
 * The width stays with the caller because it is the only thing that really differs, and it is
 * the width the tile OCCUPIES: a band of large tiles draws wider than a column two tiles wide,
 * and what the CDN is then asked for is worked out here rather than at each call site — three
 * of them had written their own factor, and none of the three agreed with the others.
 */
export function cloudTileFace(
  asset: CloudAsset,
  cssWidth: number,
): { url: string | undefined; caption: string; fallbackIcon: string } {
  return {
    url: cloudPreviewUrl(asset, askedWidth(cssWidth, asset.width)) ?? undefined,
    caption: asset.name,
    fallbackIcon: assetIcon(asset.type),
  }
}
