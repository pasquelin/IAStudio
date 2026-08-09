import { z } from 'zod'
import type { TextureExportRequest } from '@shared/ipc'

/**
 * An exported texture crosses the boundary as bytes and as names this process joins to a path
 * it chose. Both are checked rather than trusted: the renderer is the sandboxed side, and a
 * name carrying a separator is a write outside the folder the user picked.
 */

/**
 * A name that is one path segment and nothing else. `.` and `..` are refused by name — neither
 * holds a separator, and `join` reads both as somewhere other than where they were written.
 */
const segment = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(value => !/[/\\]/.test(value))
  .refine(value => value !== '.' && value !== '..')

/** What a target writes. An unknown one would be an extension chosen by the sandboxed side. */
const extension = z.enum(['.png', '.glb'])

/**
 * Bounded per file and, below, in total. A 4K channel encodes well under this; the ceiling is
 * there because an unbounded buffer written to disk is a full partition away.
 */
const MAX_FILE_BYTES = 512 * 1024 * 1024

/** Eight raw channels is the widest an export gets, and the margin above it is deliberate. */
const MAX_FILES = 16

const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024

const file = z.object({
  name: segment,
  extension,
  bytes: z.instanceof(Uint8Array).refine(value => value.byteLength <= MAX_FILE_BYTES),
})

const textureExport = z
  .object({
    folder: segment,
    files: z.array(file).min(1).max(MAX_FILES),
  })
  .refine(
    value =>
      value.files.reduce((total, entry) => total + entry.bytes.byteLength, 0) <= MAX_TOTAL_BYTES,
  )

export function parseTextureExport(value: unknown): TextureExportRequest {
  return textureExport.parse(value)
}
