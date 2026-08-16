/**
 * Reads back the text a text model wrote.
 *
 * The output of `model_scenario-llm` is an asset, not a string in the response — measured, not
 * assumed. Reading it back would be a second round trip every turn, except that the asset record
 * already carries the text: `properties.preview` holds it in full whenever `hasFullPreview` is
 * true, which for a reply of a few hundred characters it always is. The download is the fallback
 * for a long answer, and in practice the assistant's answers are short by construction — they
 * are one JSON object.
 */

type TextAsset = {
  url?: string
  properties?: { preview?: string; hasFullPreview?: boolean }
}

export type AssetTextDeps = {
  retrieve: (assetId: string) => Promise<TextAsset>
  /** Fetches the asset's own body, for the answers too long to have been previewed. */
  download: (url: string) => Promise<string>
}

export function createAssetText({ retrieve, download }: AssetTextDeps) {
  return async (assetId: string): Promise<string> => {
    const asset = await retrieve(assetId)
    const { preview, hasFullPreview } = asset.properties ?? {}

    // Only when it is the WHOLE text. A truncated preview parsed as JSON is the worst of the
    // three outcomes: it fails halfway through an object that was complete on the server.
    if (hasFullPreview === true && typeof preview === 'string') return preview

    return asset.url === undefined ? '' : await download(asset.url)
  }
}
