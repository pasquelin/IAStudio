import type { FiledAsset } from './catalog'

/**
 * The disk, as reconciling with it needs to see it. Injected: what this file decides is worth
 * testing, and none of those decisions need a real folder to be made.
 */
export type RescanDisk = {
  /** Every file the project holds, relative to its root — the explorer's own walk. */
  list: () => Promise<readonly string[]>
  /**
   * What identifies the bytes at `path`, or `null` when it cannot be read.
   *
   * The same fingerprint an import records (`hashSource`): head, middle and tail plus the size,
   * which is what makes matching a moved file cost a few reads rather than a full pass over
   * twenty gigabytes.
   */
  hash: (path: string) => Promise<string | null>
}

/** The rows the rescan writes to, and nothing else of a catalogue. */
export type RescanCatalog = {
  filed: () => FiledAsset[]
  repath: (from: string, to: string) => void
  markMissing: (path: string, at: string | null) => void
}

export type RescanOptions = {
  now: () => string
  /** Whether to stop. Read between batches, which is the only place a stop can be honoured. */
  stopped: () => boolean
  /** Yields to the event loop, so the port is polled and a stop is actually seen. */
  yieldTo: () => Promise<void>
  onProgress: (progress: RescanProgress) => void
}

export type RescanProgress = {
  /** Files fingerprinted so far, out of how many the pass will fingerprint. */
  done: number
  total: number
}

/**
 * What one pass changed. Counts rather than lists: a window shows a sentence, and carrying ten
 * thousand paths across the thread to say "nothing moved" is the shape this avoids.
 */
export type RescanReport = {
  /** Rows whose file was found again, under a new path — followed by their fingerprint. */
  moved: number
  /** Rows dated as gone by THIS pass. A row already dated is not counted again. */
  missing: number
  /** Rows whose file was where the catalogue said, having been dated gone before. */
  returned: number
  /** Whether the pass ran to the end. A stopped pass keeps what it had already written. */
  complete: boolean
}

/** How many files are fingerprinted before the loop is given back. */
const BATCH = 128

/**
 * Puts the catalogue and the disk back in agreement, one pass.
 *
 * **It never deletes a row.** A file that is not where the catalogue says is looked for by its
 * fingerprint among the files no row claims; found, the row is refiled at the new path (`repath`,
 * so the ids do not change and every scene keeps pointing at its texture); not found, the row is
 * DATED. The prompt, the seed and the lineage are not on the disk, and losing them because a
 * file was moved into a folder the studio could not follow is the failure this exists to prevent.
 * `forgetUnder` is what actually drops rows, and it is a gesture the user makes.
 *
 * **Two passes give the same state.** Everything it writes is derived from what it read, and a
 * row already dated is not dated again — which is what lets this run on every open and every
 * return to the window without saying the same thing twice.
 *
 * **Ambiguity does nothing.** Two files sharing a fingerprint — the same picture copied — cannot
 * say which of them a row meant, so the row is left dated and the files are left alone. Guessing
 * would rewrite the path of a row nobody asked to move, which is the one failure a reconciliation
 * pass must not have. A later pass picks it up if the doubt lifts.
 *
 * **Nothing is fingerprinted when nothing is lost.** The ordinary pass is one walk and one
 * SELECT; the reads only start once a row's file is missing from the walk.
 */
export async function rescanProject(
  catalog: RescanCatalog,
  disk: RescanDisk,
  { now, stopped, yieldTo, onProgress }: RescanOptions,
): Promise<RescanReport> {
  const onDisk = new Set(await disk.list())
  const rows = catalog.filed()

  const lost: FiledAsset[] = []
  let returned = 0

  for (const row of rows) {
    if (!onDisk.has(row.path)) {
      lost.push(row)
      continue
    }

    // Where the catalogue said, after all — the file came back on its own, or the user put it
    // back. Nothing to move, only a date to drop.
    if (row.missingAt !== null) {
      catalog.markMissing(row.path, null)
      returned += 1
    }
  }

  if (lost.length === 0) return { moved: 0, missing: 0, returned, complete: true }

  // Only the files no row claims can be where a lost one went. A file the catalogue already
  // knows about is not up for adoption, however its bytes read.
  const claimed = new Set(rows.map(row => row.path))
  const orphans = [...onDisk].filter(path => !claimed.has(path))

  const byHash = new Map<string, string[]>()
  let done = 0

  onProgress({ done, total: orphans.length })

  for (let start = 0; start < orphans.length; start += BATCH) {
    if (stopped()) return { moved: 0, missing: 0, returned, complete: false }

    const batch = orphans.slice(start, start + BATCH)
    const hashes = await Promise.all(batch.map(path => disk.hash(path)))

    batch.forEach((path, index) => {
      const hash = hashes[index]
      if (!hash) return
      byHash.set(hash, [...(byHash.get(hash) ?? []), path])
    })

    done += batch.length
    onProgress({ done, total: orphans.length })

    // Between batches, and only here: a fingerprint cannot be interrupted once begun, so what a
    // stop actually buys is the batches that have not started.
    await yieldTo()
  }

  const at = now()
  let moved = 0
  let missing = 0
  // A file adopted by one row must not be offered to the next: two rows of the same bytes would
  // otherwise both be refiled at it, and the catalogue would hold two rows at one path.
  const taken = new Set<string>()

  for (const row of lost) {
    const candidates = (row.hash ? (byHash.get(row.hash) ?? []) : []).filter(
      path => !taken.has(path),
    )

    // Exactly one, or nothing: see the note on ambiguity above.
    const found = candidates.length === 1 ? candidates[0] : undefined

    if (found !== undefined) {
      taken.add(found)
      catalog.repath(row.path, found)
      if (row.missingAt !== null) catalog.markMissing(found, null)
      moved += 1
      continue
    }

    // Already dated by an earlier pass: saying it again is what would make running this on every
    // focus write a line to the journal every time.
    if (row.missingAt !== null) continue

    catalog.markMissing(row.path, at)
    missing += 1
  }

  return { moved, missing, returned, complete: true }
}
