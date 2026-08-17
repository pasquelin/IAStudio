import { realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'

/**
 * Where a write is allowed to land inside the open project, decided by what the disk RESOLVES TO
 * rather than by the shape of the name.
 *
 * `pathSegment` already refuses the shapes — a separator, `.`, `..`, a control character — so no
 * name reaching here can climb out by spelling. What it cannot refuse is a SYMBOLIC LINK already
 * sitting in the project under that name: it names nothing suspicious and walks straight out. Both
 * ends therefore go through `realpath`, as `git/blob.ts` does for reads, and for the same reason —
 * a project under a linked folder is ordinary, `/var` being one on macOS.
 *
 * The destination usually does not exist yet, which is the whole point of creating it: it is
 * resolved only when it is already there, and the ROOT is resolved either way.
 *
 * `.git` and `.index` are refused on top: the first holds the token a remote was cloned with, the
 * second is the catalogue database, and an export folder is neither.
 */
const RESERVED: readonly string[] = ['.git', '.index']

export async function folderInsideProject(root: string, folder: string): Promise<string | null> {
  if (RESERVED.includes(folder)) return null

  try {
    const base = await realpath(root)
    const target = join(base, folder)

    // Only when it is already there. A destination that does not exist cannot be resolved, and
    // its parent — the project root — has just been.
    const resolved = await realpath(target).catch(() => target)
    const within = relative(base, resolved)

    if (within === '' || within.startsWith('..') || isAbsolute(within)) return null
    return RESERVED.includes(within.split(sep)[0] ?? '') ? null : target
  } catch {
    return null
  }
}
