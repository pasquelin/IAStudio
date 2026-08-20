import type { FiledAsset } from './catalog'

/**
 * The disk, as reconciling with it needs to see it. Injected: what this file decides is worth
 * testing, and none of those decisions need a real folder to be made.
 */
export type RescanDisk = {
  /** Every file the project holds, relative to its root — the explorer's own walk. */
  list: () => Promise<readonly string[]>
  /**
   * Whether anything is at `path` — asked of the disk, not of the walk.
   *
   * The walk is a READER's view and turns three families away: what sits under a dot, what is
   * deeper than its bound, and what a document written as a folder holds. A row filed at one of
   * those is not gone — it is out of sight — and dating it would take the asset out of the
   * library for good while its file sat there. This is the question the walk cannot answer.
   */
  exists: (path: string) => Promise<boolean>
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
  /** By ID, never by path — see `FiledAsset.id` for the race that settles. */
  markMissing: (assetId: string, at: string | null) => void
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
 * Puts the catalogue and the disk back in agreement, one pass, and it NEVER deletes a row: a file
 * that moved is refiled by fingerprint, one that is gone is only DATED — the prompt, the seed and
 * the lineage are not on the disk. Two passes give the same state. Ambiguity does nothing, two
 * files of one fingerprint leaving the row dated rather than guessed at. Fingerprinting only
 * starts once a row's file has gone THIS pass, or one deletion would re-read the whole project on
 * every return. And what the walk does not show is not gone: the disk is asked about it directly.
 */
export async function rescanProject(
  catalog: RescanCatalog,
  disk: RescanDisk,
  { now, stopped, yieldTo, onProgress }: RescanOptions,
): Promise<RescanReport> {
  const onDisk = new Set(await disk.list())
  const rows = catalog.filed()

  /** Rows the walk did not show, which is not the same as rows whose file has gone. */
  const unseen = rows.filter(row => !onDisk.has(row.path))

  /**
   * The disk's own answer, for those rows only.
   *
   * The walk turns three families away — under a dot, past its depth bound, inside a document
   * written as a folder — and a volume that went away mid-pass answers an empty walk for
   * everything. Dating on the walk alone takes an asset out of the library for good while its
   * file sits there, and a project on a network share that blinked would empty itself.
   *
   * Bounded by construction: one `stat` per row the walk did not show, and the ordinary pass
   * shows every one of them.
   */
  const present = await Promise.all(unseen.map(row => disk.exists(row.path)))
  const lost = unseen.filter((_row, index) => present[index] === false)

  let returned = 0
  const seen = new Set(lost)

  for (const row of rows) {
    // Where the catalogue said, after all — the file came back on its own, the user put it back,
    // or the walk simply could not show it. Nothing to move, only a date to drop.
    if (!seen.has(row) && row.missingAt !== null) {
      catalog.markMissing(row.id, null)
      returned += 1
    }
  }

  /**
   * The fingerprints worth looking for: the rows that went missing THIS pass.
   *
   * A row already dated is not among them, and that is two things at once. It is what keeps a
   * single file deleted for good from re-hashing every uncatalogued file of the project on every
   * return to the window, for ever. And it is what makes the trash stick: `forgetUnder` dates the
   * rows of a folder the user threw away, and a fingerprint search would hand one of them back on
   * the first identical file it found elsewhere — undoing a deliberate gesture with an automatic
   * pass. A dated row comes back the one way that cannot be mistaken: its file, at its path.
   *
   * A row imported before fingerprints were recorded is not among them either — reading files on
   * its behalf would be reading them for an answer that could never come.
   */
  const wanted = new Set(
    lost.flatMap(row => (row.missingAt === null && row.hash ? [row.hash] : [])),
  )

  const byHash = wanted.size === 0 ? new Map<string, string | null>() : await fingerprints()

  async function fingerprints(): Promise<Map<string, string | null>> {
    // Only the files no row claims can be where a lost one went. A file the catalogue already
    // knows about is not up for adoption, however its bytes read.
    const claimed = new Set(rows.map(row => row.path))
    const orphans = [...onDisk].filter(path => !claimed.has(path))

    // `null` marks a fingerprint two files share: it cannot say which of them a row meant, and
    // the second one arriving is what turns the first into a refusal. See the note above.
    const found = new Map<string, string | null>()
    onProgress({ done: 0, total: orphans.length })

    for (let start = 0; start < orphans.length; start += BATCH) {
      if (stopped()) return found

      const batch = orphans.slice(start, start + BATCH)
      const hashes = await Promise.all(batch.map(path => disk.hash(path)))

      batch.forEach((path, index) => {
        const hash = hashes[index]
        if (!hash || !wanted.has(hash)) return
        found.set(hash, found.has(hash) ? null : path)
      })

      onProgress({ done: Math.min(start + BATCH, orphans.length), total: orphans.length })

      // Between batches, and only here: a fingerprint cannot be interrupted once begun, so what
      // a stop actually buys is the batches that have not started.
      await yieldTo()
    }

    return found
  }

  if (stopped()) return { moved: 0, missing: 0, returned, complete: false }

  const at = now()
  let moved = 0
  let missing = 0
  // A file adopted by one row must not be offered to the next: two rows of the same bytes would
  // otherwise both be refiled at it, and the catalogue would hold two rows at one path.
  const taken = new Set<string>()

  for (const row of lost) {
    // Only a row that went missing THIS pass looks for its file by fingerprint — see `wanted`.
    const found = row.missingAt === null && row.hash ? byHash.get(row.hash) : null

    if (found && !taken.has(found)) {
      taken.add(found)
      catalog.repath(row.path, found)
      moved += 1
      continue
    }

    // Already dated by an earlier pass: saying it again is what would make running this on every
    // focus write a line to the journal every time.
    if (row.missingAt !== null) continue

    catalog.markMissing(row.id, at)
    missing += 1
  }

  return { moved, missing, returned, complete: true }
}
