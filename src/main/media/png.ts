import type { MediaProbe } from '@shared/domain/asset'

/** The eight bytes every PNG opens with. A file that does not is not one, whatever it is called. */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Signature, chunk length, `IHDR`, then the two dimensions — 24 bytes before anything else. */
const HEADER_BYTES = 24
const IHDR = 0x49484452

/** Whether decoded bytes really are a PNG — the guard `savePicture` and `saveTexture` both make. */
export function isPngBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < SIGNATURE.length) return false
  return SIGNATURE.every((byte, index) => bytes[index] === byte)
}

/**
 * What a PNG's header says about itself.
 *
 * Read rather than carried over, for the reason `probeWav` gives about a take: a probe from
 * before an edit is worse than none. A picture overwritten by ⌘S kept the dimensions of the one
 * it replaced, so the inspector went on announcing 4112 × 2658 over a file that had become
 * 1024² — the one reader that could have shown the loss instead hid it.
 *
 * Only the IHDR is read, which the format puts first in every PNG. A file laid out otherwise
 * answers null rather than guessing.
 */
export function probePng(bytes: Uint8Array): MediaProbe | null {
  if (!isPngBytes(bytes) || bytes.byteLength < HEADER_BYTES) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(12) !== IHDR) return null

  const width = view.getUint32(16)
  const height = view.getUint32(20)
  // A side of zero is not a picture, and it would divide by nothing everywhere downstream.
  if (width === 0 || height === 0) return null

  return { duration: 0, codec: 'png', width, height }
}
