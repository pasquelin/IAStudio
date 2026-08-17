import { execFile as execFileCallback } from 'node:child_process'
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

/**
 * How much of a file will be brought back to be looked at.
 *
 * A ceiling rather than a hope: the bytes cross the IPC boundary and are held in a renderer as a
 * blob, and a project holds video. Thirty-two megabytes covers any still a studio compares and
 * refuses the take that would freeze the window it was meant to be shown in.
 */
const BLOB_MAX_BYTES = 32 * 1024 * 1024

/**
 * The bytes of one file as one recorded version holds it.
 *
 * Spawned directly rather than through the port, and the reason is the bytes themselves:
 * simple-git decodes what git writes into a string, which is exactly the wrong thing to do to a
 * PNG. `encoding: 'buffer'` is what keeps them intact.
 *
 * Outside the command queue as well, and safely so — this only ever READS, so it takes no
 * `index.lock` and cannot collide with the commands that do.
 *
 * `null` for anything that did not work out: a path the version does not hold, a file past the
 * ceiling, a binary that would not start. The panel says the comparison cannot be drawn, which
 * is the same sentence for all three and the only one it could act on.
 */
export async function blobAt(
  root: string,
  ref: string,
  path: string,
  binary = 'git',
): Promise<Uint8Array | null> {
  try {
    const { stdout } = await execFile(binary, ['show', `${ref}:${path}`], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: BLOB_MAX_BYTES,
      // Nothing of the shell: the arguments are already validated, and a shell would put them
      // back through a second round of interpretation that the validation never saw.
      shell: false,
    })

    return new Uint8Array(stdout)
  } catch {
    return null
  }
}

/**
 * Where a read is allowed to land, decided by what the disk RESOLVES TO rather than by the shape
 * of the path. `gitPath` refuses the shapes it knows — absolute, climbing, glob — and a shape is a
 * blocklist: a versioned symbolic link names nothing suspicious and walks straight out. Both ends
 * go through `realpath`, because a project under a linked folder is ordinary (on macOS `/var` is
 * one, and every temporary folder a test makes lives there). `.git` is refused as well: it is
 * inside the project, and its config file holds the token a remote was cloned with.
 */
async function fileInside(root: string, path: string): Promise<string | null> {
  try {
    const file = await realpath(join(root, path))
    const within = relative(await realpath(root), file)

    if (within.startsWith('..') || isAbsolute(within)) return null
    return within.split(sep)[0] === '.git' ? null : file
  } catch {
    return null
  }
}

/**
 * The bytes of the file as it stands on disk — the other half of a comparison, when what is
 * being compared is a change that has not been recorded yet.
 *
 * The size is asked BEFORE the read rather than after: reading a two-gigabyte take into memory
 * to then decide it is too big is the failure this ceiling exists to prevent.
 */
export async function workingBlob(root: string, path: string): Promise<Uint8Array | null> {
  const file = await fileInside(root, path)
  if (file === null) return null

  try {
    if ((await stat(file)).size > BLOB_MAX_BYTES) return null
    return new Uint8Array(await readFile(file))
  } catch {
    return null
  }
}
