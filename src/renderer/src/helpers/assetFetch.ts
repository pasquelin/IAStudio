import { assetMasterUrl, assetUrl } from '@shared/domain/asset'

/**
 * An asset's bytes, over the `ia-studio://` scheme.
 *
 * The renderer never handles a file path: main resolves the id against the catalogue.
 */
export async function fetchAsset(assetId: string): Promise<Response> {
  return fetchOver(assetUrl(assetId), assetId)
}

/** The original, for an export that must not play the 720p proxy. */
export async function fetchOriginalAsset(assetId: string): Promise<Response> {
  return fetchOver(assetMasterUrl(assetId), assetId)
}

async function fetchOver(url: string, assetId: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`asset ${assetId} could not be read`)
  return response
}
