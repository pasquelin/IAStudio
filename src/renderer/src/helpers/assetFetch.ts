import { assetUrl } from '@shared/domain/asset'

/**
 * An asset's bytes, over the `scenario://` scheme.
 *
 * The renderer never handles a file path: the main process resolves the id against the
 * catalogue when it serves the scheme. Written once — the video monitor and the audio decoder
 * both need it, and both had copied the same two lines.
 */
export async function fetchAsset(assetId: string): Promise<Response> {
  const response = await fetch(assetUrl(assetId))
  if (!response.ok) throw new Error(`asset ${assetId} could not be read`)
  return response
}
