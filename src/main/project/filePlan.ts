import type { PathChange, Refusal } from '@shared/domain/fileOp'
import { extensionOf, foldForFileName, stemForSuffix, stemOf } from '@shared/domain/fileName'
import { isPrivatePath, moveRefusal, nameOf, parentOf, pathIn } from '@shared/domain/folder'

/**
 * One thing the disk is asked to do. The planner speaks these; `fileOps` carries them out.
 *
 * Told apart from `PathChange`, which is the EFFECT the journal, the catalogue and the undo
 * stack read: a copy and a move both leave a file at `to`, and only one of them left one at
 * `from` — reading the effect off the act is what lets those three know nothing about acts.
 */
export type FileAct =
  | { act: 'move'; from: string; to: string }
  | { act: 'copy'; from: string; to: string }
  | { act: 'createFolder'; to: string }
  | { act: 'trash'; from: string }

/** What the explorer asks for. One shape, so one planner answers all of them. */
export type FileRequest =
  | { op: 'rename'; path: string; name: string }
  | { op: 'move'; paths: readonly string[]; folder: string }
  /** `folder` is `null` for a copy laid beside its source — what « Dupliquer » does. */
  | { op: 'duplicate'; paths: readonly string[]; folder: string | null }
  | { op: 'createFolder'; folder: string; name: string }
  | { op: 'trash'; paths: readonly string[] }

/**
 * What the folders concerned hold, read once before anything is planned.
 *
 * A folder that is missing from the map does not exist — that is the whole of how a destination
 * that has gone, or that turned out to be a file, is told apart from an empty one.
 */
export type FolderSnapshot = ReadonlyMap<string, readonly string[]>

export type FilePlan = { acts: readonly FileAct[]; refused: readonly Refusal[] }

/** What a `PathChange` says of an act. `''` on either side is a file that came or went. */
export function changeOf(act: FileAct): PathChange {
  if (act.act === 'move') return { from: act.from, to: act.to }
  if (act.act === 'trash') return { from: act.from, to: '' }
  return { from: '', to: act.to }
}

/**
 * The act that puts a change back, or nothing at all.
 *
 * A file that was trashed has no inverse and answers `null`: `shell.trashItem` offers no
 * portable way back, which is why undo deliberately stops at the trash — see the plan.
 */
export function inverseOf(change: PathChange): FileAct | null {
  if (change.from && change.to) return { act: 'move', from: change.to, to: change.from }
  if (change.to) return { act: 'trash', from: change.to }
  return null
}

/** Which folders have to be read before this request can be planned. */
export function foldersFor(request: FileRequest): readonly string[] {
  if (request.op === 'rename') return [parentOf(request.path) ?? '']
  if (request.op === 'createFolder') return [request.folder]

  const parents = request.paths.map(path => parentOf(path) ?? '')
  if (request.op === 'trash') return parents
  return request.folder === null ? parents : [...parents, request.folder]
}

/** Whether the snapshot says something sits at `path`. The root always does. */
function present(folders: FolderSnapshot, path: string): boolean {
  const parent = parentOf(path)
  const entries = folders.get(parent ?? '')
  return entries !== undefined && entries.some(entry => entry === nameOf(path))
}

/**
 * The first name in `folder` nobody holds — `Ruelle bleue.png`, then `Ruelle bleue 2.png`.
 *
 * Folded, because APFS and NTFS hold one file for two spellings of a name, and a raw comparison
 * would call the second one free. Bounded by `stemForSuffix`, which keeps room for the suffix:
 * a stem already at the length limit comes back cut to itself, every candidate then reads as
 * taken, and the loop would never end — in the process that owns every window.
 *
 * The disk-bound twin of this lives in `assets/assetFile.ts` and answers for an ASSET, whose
 * name and extension are held apart by the catalogue. Here there is one file name and no row.
 */
export function freeName(taken: ReadonlySet<string>, fileName: string): string {
  const held = (candidate: string): boolean => taken.has(foldForFileName(candidate))
  if (!held(fileName)) return fileName

  const extension = extensionOf(fileName)
  const stem = stemForSuffix(stemOf(fileName))

  for (let n = 2; ; n += 1) {
    const candidate = `${stem} ${n}${extension}`
    if (!held(candidate)) return candidate
  }
}

function foldedNames(folders: FolderSnapshot, folder: string): Set<string> {
  return new Set((folders.get(folder) ?? []).map(foldForFileName))
}

/**
 * What a batch would do to the project folder, and what it would refuse.
 *
 * Pure, and that is where the effort of this phase goes: every case worth arguing about — a
 * folder dropped into itself, a name already taken, a source that has gone, one of the studio's
 * own paths — is a table of strings in and a table of strings out. What is left for `fileOps`
 * is the ORDER of the writes, which is the one thing a test of this file cannot claim.
 *
 * Names taken WITHIN the batch count as taken: moving `a/x.png` and `b/x.png` into the same
 * folder is one move and one refusal, never two files racing for the same name.
 */
export function planFiles(request: FileRequest, folders: FolderSnapshot): FilePlan {
  const acts: FileAct[] = []
  const refused: Refusal[] = []

  if (request.op === 'createFolder') {
    const parent = request.folder
    const own = isPrivatePath(parent)
    if (own || !folders.has(parent)) {
      refused.push({ path: parent, reason: own ? 'private' : 'missing' })
      return { acts, refused }
    }

    const taken = foldedNames(folders, parent)
    const target = parent === '' ? request.name : `${parent}/${request.name}`
    if (taken.has(foldForFileName(request.name))) refused.push({ path: target, reason: 'exists' })
    else acts.push({ act: 'createFolder', to: target })

    return { acts, refused }
  }

  if (request.op === 'rename') {
    const { path, name } = request
    const parent = parentOf(path) ?? ''

    if (isPrivatePath(path)) refused.push({ path, reason: 'private' })
    else if (!present(folders, path)) refused.push({ path, reason: 'missing' })
    else {
      const target = pathIn(parent, name)
      const taken = foldedNames(folders, parent)
      // Case alone is not a collision: it is this very file, respelled.
      taken.delete(foldForFileName(nameOf(path)))

      if (taken.has(foldForFileName(name))) refused.push({ path: target, reason: 'exists' })
      else if (target !== path) acts.push({ act: 'move', from: path, to: target })
    }

    return { acts, refused }
  }

  if (request.op === 'trash') {
    for (const path of request.paths) {
      // `shown`, which is the one gesture that reads the rule that way: what a folder of the
      // studio HOLDS may be thrown away — the catalogue lets go of the rows underneath — where
      // the folder itself is the layout the project is read by. Nothing under a dot may go.
      if (isPrivatePath(path, 'shown')) refused.push({ path, reason: 'private' })
      else if (!present(folders, path)) refused.push({ path, reason: 'missing' })
      else acts.push({ act: 'trash', from: path })
    }

    return { acts, refused }
  }

  // Move and duplicate share everything but their act: one lands the file in the destination
  // under its own name, the other under a free one — and either may name no destination at all,
  // which means "where it already is".
  const moving = request.op === 'move'
  const into = request.folder

  if (into !== null) {
    const own = isPrivatePath(into)
    if (own || !folders.has(into)) {
      for (const path of request.paths) refused.push({ path, reason: own ? 'private' : 'missing' })
      return { acts, refused }
    }
  }

  const claimed = new Map<string, Set<string>>()
  const namesIn = (folder: string): Set<string> => {
    const held = claimed.get(folder) ?? foldedNames(folders, folder)
    claimed.set(folder, held)
    return held
  }

  for (const path of request.paths) {
    if (!present(folders, path)) {
      refused.push({ path, reason: 'missing' })
      continue
    }

    const folder = into ?? parentOf(path) ?? ''

    // The one spelling of the rule, shared with the panel that greys the gesture out: what the
    // studio holds for itself, and a folder dropped into itself. What this file adds on top is
    // everything only a reading of the folders can say — missing, and taken.
    const refusal = moveRefusal(path, folder)
    if (refusal) {
      refused.push({ path, reason: refusal })
      continue
    }

    const held = namesIn(folder)
    const name = nameOf(path)

    if (moving) {
      // Already where it is being sent: nothing to do, and nothing to complain about.
      if (folder === (parentOf(path) ?? '')) continue

      if (held.has(foldForFileName(name))) {
        refused.push({ path, reason: 'exists' })
        continue
      }

      held.add(foldForFileName(name))
      acts.push({ act: 'move', from: path, to: pathIn(folder, name) })
      continue
    }

    // Suffixed until free rather than refused: a copy the user asked for beside a file that is
    // by definition already there has nobody to hand a refusal back to.
    const free = freeName(held, name)
    held.add(foldForFileName(free))
    acts.push({ act: 'copy', from: path, to: folder === '' ? free : `${folder}/${free}` })
  }

  return { acts, refused }
}

/**
 * What a planner reads the project as: only the folders asked for, and only those the disk
 * answers for — a folder missing from the map is one that does not exist, which is how
 * `planFiles` refuses a destination that has gone.
 */
export async function folderSnapshot(
  names: (folder: string) => Promise<readonly string[] | null>,
  folders: readonly string[],
): Promise<FolderSnapshot> {
  const unique = [...new Set(folders)]
  const read = await Promise.all(unique.map(one => names(one)))

  const known = new Map<string, readonly string[]>()
  for (const [at, entries] of read.entries()) {
    const path = unique[at]
    if (path !== undefined && entries !== null) known.set(path, entries)
  }
  return known
}
