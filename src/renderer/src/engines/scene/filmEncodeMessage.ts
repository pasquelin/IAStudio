export type FilmEncodeRequest = {
  id: number
  pixels: Uint8Array
  width: number
  height: number
  /**
   * Whether the pixels are ALREADY in sRGB. A plain render leaves the working space in a target,
   * so the bytes have to be encoded on the way to a PNG; a composed one has been through the
   * output transform and encoding it a second time washes the film out — with every gate green.
   */
  encoded: boolean
}

export type FilmEncodeResponse = { id: number; bytes: Uint8Array } | { id: number; failure: string }
