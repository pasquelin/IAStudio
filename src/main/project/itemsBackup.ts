import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { STUDIO_FOLDER } from '@shared/domain/project'
import { writeAtomic } from '@main/persistence'
import type { BackedUpItem } from './catalog'
import type { RescanReport } from './catalogRescan'

/**
 * Where the backup sits. Under a dot, so it is the studio's own by the one rule that says so —
 * shown to a reader who asks, refused by every gesture, and never walked into by a listing.
 */
export const ITEMS_BACKUP = `${STUDIO_FOLDER}/items.json`

const ITEMS_BACKUP_VERSION = 1

/**
 * What a project's files were, keyed by what their bytes fingerprint to.
 *
 * **A backup, never a source.** The catalogue is what the studio reads; nothing loads this on
 * its own, and a project whose `.index/` is intact never consults it. What it answers is the one
 * question a lost database leaves: this file is here, and something is on the other side of its
 * fingerprint — what was it called, what was it made from, what was asked for.
 *
 * Keyed by fingerprint rather than by path or by id, and each of the other two says why: a path
 * is what the user is free to change, and an id means nothing to someone reading the file by
 * hand or matching it against files they still have.
 *
 * Rows with no fingerprint are left out. They cannot be matched to anything by this file's own
 * key, so writing them would be writing a list nobody can look anything up in.
 */
export type ItemsBackup = {
  version: number
  writtenAt: string
  items: Record<string, BackedUpItem>
}

export function itemsBackupOf(rows: readonly BackedUpItem[], writtenAt: string): ItemsBackup {
  const items: Record<string, BackedUpItem> = {}

  // Last wins, and it is arbitrary on purpose: two rows of one fingerprint are the same bytes
  // twice, so whichever is written the file answers the same question about the same file.
  for (const row of rows) items[row.hash] = row

  return { version: ITEMS_BACKUP_VERSION, writtenAt, items }
}

/**
 * Writes the backup beside the project, atomically.
 *
 * Atomic because this is exactly the file a half-write would make useless: it is read when the
 * database is already gone, so a truncated one would be the second loss after the first.
 * Indented, because a file that exists to be read by a human when everything else has failed is
 * not a file to minify.
 */
export async function writeItemsBackup(root: string, backup: ItemsBackup): Promise<void> {
  const file = join(root, ITEMS_BACKUP)
  await mkdir(dirname(file), { recursive: true })
  await writeAtomic(file, JSON.stringify(backup, null, 2))
}

/**
 * Whether a reconciliation pass is worth writing the backup after — the policy, beside the file
 * it decides about rather than in the routing that happens to call it.
 *
 * A COMPLETE pass, because a stopped one read part of the folder and a backup of that would be a
 * backup of less than what exists. A pass that CHANGED something, because rebuilding the whole
 * table costs a full scan and a JSON of every row: the ordinary pass runs on every return to the
 * window and finds nothing moved, and paying that each time would make the pass the expensive
 * thing rather than the quiet one.
 */
export function worthBackingUp({ complete, moved, missing, returned }: RescanReport): boolean {
  return complete && moved + missing + returned > 0
}
