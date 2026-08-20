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
  // A container is a ZIP, which no previewer decodes: its own thumbnail is the picture of it.
  // Without this, every layered picture in the Explorer drew a blank tile — while the same file,
  // asked for through the asset scheme, drew fine.
  if (extname(file).toLowerCase() === '.ora') {
    const { containerPictureOf } = await import('@main/assets/openRasterFile')
    const picture = await containerPictureOf(file)
    return picture ? reduced(nativeImage.createFromBuffer(Buffer.from(picture)), size) : null
  }

  try {
    const image = await nativeImage.createThumbnailFromPath(file, { width: size, height: size })
    if (!image.isEmpty()) return image.toPNG()
  } catch {
    // Absent on this platform, or a file it declines to read. Both are worth one attempt below.
  }

  if (!DECODABLE.includes(extname(file).toLowerCase())) return null

  return reduced(nativeImage.createFromPath(file), size)
}

/**
 * Bounded on its LONGEST side, not on its width: a 100 × 5000 picture asked to fit 256 came back
 * five thousand pixels tall.
 */
function reduced(image: Electron.NativeImage, size: number): Uint8Array | null {
  if (image.isEmpty()) return null

  const { width, height } = image.getSize()
  if (Math.max(width, height) <= size) return image.toPNG()

  const side = width >= height ? { width: size } : { height: size }
  return image.resize({ ...side, quality: 'good' }).toPNG()
}
