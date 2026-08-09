import { z } from 'zod'
import type { TextureExportRequest } from '@shared/ipc'
import { pathSegment } from '@main/validation'

/**
 * An exported texture crosses the boundary as bytes and as names this process joins to a path
 * it chose. Both are checked rather than trusted: the renderer is the sandboxed side, and a
 * name carrying a separator is a write outside the folder the user picked.
 */

/** What a target writes. An unknown one would be an extension chosen by the sandboxed side. */
const extension = z.enum(['.png', '.glb'])

/**
 * What one export may weigh, all of its files together.
 *
 * Eight 4K channels come to a few hundred megabytes, and this leaves room above that. One
 * ceiling rather than one per file as well: the total already bounds every file under it, and
 * the request crosses the boundary by structured clone — so what this really bounds is a copy
 * made in each of the two processes.
 */
const MAX_EXPORT_BYTES = 512 * 1024 * 1024

/** Eight raw channels is the widest an export gets, and the margin above it is deliberate. */
const MAX_FILES = 16

const file = z.object({
  name: pathSegment,
  extension,
  bytes: z.instanceof(Uint8Array),
})

const textureExport = z
  .object({
    folder: pathSegment,
    files: z.array(file).min(1).max(MAX_FILES),
  })
  .refine(
    value =>
      value.files.reduce((total, entry) => total + entry.bytes.byteLength, 0) <= MAX_EXPORT_BYTES,
  )

export function parseTextureExport(value: unknown): TextureExportRequest {
  return textureExport.parse(value)
}
