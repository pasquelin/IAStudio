import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { hashOrNull } from '@main/media/runner'
import { isMissing } from '@main/persistence'
import { createFolderReader } from './folder'
import type { RescanDisk } from './catalogRescan'

/**
 * The project folder, as reconciling with it needs it — inside the catalogue's own thread.
 *
 * Both halves run there and neither may run anywhere else. The walk of a project of a hundred
 * thousand files and the fingerprinting of whatever moved are exactly the kind of work CLAUDE.md
 * § 6 keeps off the thread that owns every window; the catalogue already has a thread, and this
 * is what lets the pass read the disk and write the rows without crossing back.
 *
 * The explorer's own reader, not a second walk: same depth bound, same refusal to descend into a
 * document written as a folder, same exclusion of everything under a dot. A file the explorer
 * cannot show is a file no row should be refiled at.
 *
 * The language only settles how a listing is ordered, and this one is never shown — `'en'` is
 * arbitrary and says so.
 */
export function openProjectDisk(root: string): RescanDisk {
  const reader = createFolderReader(
    () => root,
    () => 'en',
  )

  return {
    list: async () => (await reader.walk()).map(entry => entry.path),

    // The disk itself, not the walk — see `RescanDisk.exists`. A path that cannot be reached at
    // all answers "there", which is the safe way round: the pass then dates nothing, where the
    // other way it would date everything on a volume that blinked.
    exists: async path =>
      await stat(join(root, path)).then(
        () => true,
        error => !isMissing(error),
      ),

    // `null` rather than a throw: a file that will not read — permissions, a volume that went
    // away mid-pass — must cost the row it might have matched, never the whole pass.
    hash: path => hashOrNull(join(root, path)),
  }
}
