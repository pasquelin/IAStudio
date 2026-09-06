export type AnimationThumbnailRequest = {
  id: number
  model?: ArrayBuffer
  decoderRoot?: string
  animationUrl: string
  name: string
}
export type AnimationThumbnailResponse =
  { id: number; ok: true; png: Uint8Array } | { id: number; ok: false; error: string }
