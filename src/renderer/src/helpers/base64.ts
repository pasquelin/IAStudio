/**
 * Bytes as base64, in bounded slices. `String.fromCharCode(...bytes)` on a 4K picture spreads
 * millions of arguments onto the stack, which throws rather than answering.
 *
 * Here rather than in the engine that wrote it: the save path needs it too, and it must not pull
 * PixiJS into the opening chunk to get it.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let at = 0; at < bytes.length; at += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(at, at + 0x8000)))
  }
  return btoa(chunks.join(''))
}
