export type FilmEncodeRequest = {
  id: number
  pixels: Uint8Array
  width: number
  height: number
}

export type FilmEncodeResponse = { id: number; bytes: Uint8Array } | { id: number; failure: string }
