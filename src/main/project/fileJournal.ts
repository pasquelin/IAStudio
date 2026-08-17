import { appendFile, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { PathChange } from '@shared/domain/fileOp'
import { PENDING_FILES_FILE } from '@shared/domain/project'
import { isRecord } from '@shared/guards'
import { isMissing } from '@main/persistence'
import type { AsyncCatalog } from './catalogClient'

/**
 * What a move that stopped halfway left behind, read back.
 *
 * Pure, and separate from the disk for the reason every planner here is: a crash is not something
 * a test can arrange, but the FILE a crash leaves is — including its last line, cut in half by a
 * machine that stopped mid-write. Such a line does not parse, and a line that does not parse is
 * skipped rather than failing the replay: the moves before it are real, and refusing them all
 * over the last one would strand the whole project.
 */
export function replayMoves(body: string): PathChange[] {
  const moves: PathChange[] = []

  for (const line of body.split('\n')) {
    if (!line) continue

    try {
      const parsed: unknown = JSON.parse(line)
      if (!isRecord(parsed)) continue

      const { from, to } = parsed
      if (typeof from === 'string' && typeof to === 'string' && from && to) moves.push({ from, to })
    } catch {
      // A truncated last line, which is exactly what an interrupted append leaves.
    }
  }

  return moves
}

/**
 * Writes down a move that has ALREADY happened on disk.
 *
 * Appended rather than rewritten: three hundred files rewriting a growing file each time is
 * quadratic, where an append of one short line is not. It is also atomic below `PIPE_BUF`, so the
 * worst an interrupted write leaves is a half line — which `replayMoves` knows to skip.
 *
 * Called after the rename and before the catalogue, which is the only order that leans safe: the
 * window it leaves open is one file whose row still names where it was, and that is what the
 * reconciliation pass exists to find.
 */
export async function appendMove(root: string, change: PathChange): Promise<void> {
  const file = join(root, PENDING_FILES_FILE)
  await mkdir(dirname(file), { recursive: true })
  await appendFile(file, `${JSON.stringify(change)}\n`, 'utf8')
}

/** Takes the journal away. Called once the catalogue agrees with the disk. */
export async function clearJournal(root: string): Promise<void> {
  await rm(join(root, PENDING_FILES_FILE), { force: true })
}

/**
 * Finishes a move the studio did not get to finish, and answers how many files it caught up on.
 *
 * Idempotent by construction rather than by bookkeeping: `repath` looks for rows AT the old path,
 * and a move already recorded left none there. Replaying a journal twice therefore costs two
 * queries per line and changes nothing — which is what lets this run on every opening without
 * asking whether it is needed.
 */
export async function applyJournal(root: string, catalog: AsyncCatalog): Promise<number> {
  let body: string
  try {
    body = await readFile(join(root, PENDING_FILES_FILE), 'utf8')
  } catch (error) {
    if (isMissing(error)) return 0
    throw error
  }

  const moves = replayMoves(body)
  for (const { from, to } of moves) await catalog.repath(from, to)

  await clearJournal(root)
  return moves.length
}
