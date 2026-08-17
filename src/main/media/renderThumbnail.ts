import { nativeImage } from 'electron'

/**
 * A small picture of whatever the machine can preview — the file itself where it is one, and
 * what the system's own previewer draws where it is not.
 *
 * `createThumbnailFromPath` hands the work to the OS and answers a promise, which is what keeps
 * a 4K source from freezing every window for a tenth of a second (CLAUDE.md, invariant 6). It is
 * declared for macOS and Windows alone, so Linux falls back to decoding the file here — which
 * covers the pictures a browser reads and nothing else.
 *
 * A kind neither can read — a `.glb`, a sound — comes back null, and the caller draws its glyph.
 */
export async function renderThumbnail(file: string, size: number): Promise<Uint8Array | null> {
  try {
    const image = await nativeImage.createThumbnailFromPath(file, { width: size, height: size })
    if (!image.isEmpty()) return image.toPNG()
  } catch {
    // Absent on this platform, or a file it declines to read. Both are worth one attempt below.
  }

  const image = nativeImage.createFromPath(file)
  if (image.isEmpty()) return null

  const { width } = image.getSize()
  return (width > size ? image.resize({ width: size, quality: 'good' }) : image).toPNG()
}
