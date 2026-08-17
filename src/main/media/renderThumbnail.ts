import { nativeImage } from 'electron'
import { extname } from 'node:path'

/**
 * What `createFromPath` is worth reading. It is SYNCHRONOUS and reads the whole file, so it is
 * asked only of the suffixes it can actually decode — offered a folder of 50 MB models it would
 * read every one of them on the main thread and answer nothing.
 *
 * Chromium decodes these; `.avif` is here because it is a picture of full standing in this
 * repository, and on Linux — where the first attempt is absent rather than failing — this
 * fallback is the only one there is.
 */
const DECODABLE = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif']

/**
 * A small picture of whatever the machine can preview, `null` for what it cannot. The OS draws
 * it and answers a promise — macOS and Windows only, so Linux falls to the decoder above.
 */
export async function renderThumbnail(file: string, size: number): Promise<Uint8Array | null> {
  try {
    const image = await nativeImage.createThumbnailFromPath(file, { width: size, height: size })
    if (!image.isEmpty()) return image.toPNG()
  } catch {
    // Absent on this platform, or a file it declines to read. Both are worth one attempt below.
  }

  if (!DECODABLE.includes(extname(file).toLowerCase())) return null

  const image = nativeImage.createFromPath(file)
  if (image.isEmpty()) return null

  const { width } = image.getSize()
  return (width > size ? image.resize({ width: size, quality: 'good' }) : image).toPNG()
}
