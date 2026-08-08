/**
 * What the SDK is asked for here, and nothing more — the same narrow port the model registry
 * and the job manager take, so a test hands in a recorder rather than a client.
 */
export type UploadBackend = {
  upload: (params: { name: string; image: string }) => Promise<{ asset: { id: string } }>
}

export type AssetUploader = {
  /** Returns the id of the asset the API kept, which a generation body then names. */
  upload: (name: string, image: string) => Promise<string>
}

/**
 * Above this, the API wants the multipart flow of `/v1/uploads` instead. That is out of scope,
 * so the limit is refused out loud rather than sent and rejected as an opaque 4xx.
 */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024

/** Base64 carries three bytes in four characters, padding included. */
export function decodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * Sends a picture to the account's library and hands back its id.
 *
 * Base64 in the body rather than a file: the renderer has no filesystem, and the picture it
 * sends is a canvas it just flattened — there is no file to point at. The uploaded picture
 * becomes an asset of its own, which is what makes an edit traceable back to what it edited.
 *
 * No project id: a Scenario key carries its own project, so there is none to name.
 */
export function createAssetUploader(backend: () => UploadBackend): AssetUploader {
  return {
    upload: async (name, image) => {
      // Refused out loud rather than sent: past this the API wants the multipart flow of
      // `/v1/uploads`, and what comes back otherwise is an opaque 4xx.
      if (decodedBytes(image) > MAX_UPLOAD_BYTES) throw new Error('upload-too-large')

      const response = await backend().upload({ name, image })
      return response.asset.id
    },
  }
}
