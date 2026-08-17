import { lstat } from 'node:fs/promises'
import type { FileFacts } from '@shared/domain/fileInfo'

/**
 * What the disk says about one ENTRY, `null` for a path that has gone.
 *
 * `lstat`, never `stat`: the entry is the subject, so a symbolic link answers for itself rather
 * than for its target — which is also what the explorer's own `readdir` reports beside it.
 *
 * `birthtime` answers `null` rather than its epoch: a filesystem recording none hands back the
 * Unix epoch, which would put « 01/01/1970 » on screen as though it were a fact.
 */
export async function fileFactsOf(absolute: string): Promise<FileFacts | null> {
  try {
    const found = await lstat(absolute)

    return {
      kind: found.isDirectory() ? 'folder' : 'file',
      bytes: found.size,
      createdAt: found.birthtimeMs > 0 ? found.birthtime.toISOString() : null,
      modifiedAt: found.mtime.toISOString(),
    }
  } catch {
    return null
  }
}
