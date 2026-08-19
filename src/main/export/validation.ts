import { z } from 'zod'
import {
  EXPORT_TARGET_IDS,
  exportTargetOf,
  type ExportTargetId,
} from '@shared/domain/exportRegistry'
import type { FolderExportRequest } from '@shared/ipc'
import { pathSegment } from '@main/validation'

/**
 * An export crosses the boundary as bytes and as names this process joins to a path it chose.
 * Both are checked rather than trusted: the renderer is the sandboxed side, and a name carrying
 * a separator is a write outside the folder the user picked.
 */

const isTargetId = (value: unknown): value is ExportTargetId =>
  EXPORT_TARGET_IDS.some(id => id === value)

/**
 * Which entry of the registry this is. It used to be a hand-written list of extensions, which
 * answered « some target writes this » and never « THIS target writes this » — so a sky could
 * claim a `.usdz` and be written.
 */
const target = z.custom<ExportTargetId>(isTargetId)

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
  extension: z.string(),
  bytes: z.instanceof(Uint8Array),
})

const folderExport = z
  .object({
    folder: pathSegment,
    target,
    files: z.array(file).min(1).max(MAX_FILES),
  })
  .refine(
    value =>
      value.files.reduce((total, entry) => total + entry.bytes.byteLength, 0) <= MAX_EXPORT_BYTES,
  )
  // Checked against the target rather than against every extension the studio writes anywhere:
  // the sandboxed side names the file, and this is what stops one target's name from riding in
  // under another's.
  .refine(value =>
    value.files.every(entry => entry.extension === exportTargetOf(value.target).extension),
  )

export function parseFolderExport(value: unknown): FolderExportRequest {
  return folderExport.parse(value)
}
