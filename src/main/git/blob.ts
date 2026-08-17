import { execFile as execFileCallback } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

/**
 * How much of a file will be brought back to be looked at.
 *
 * A ceiling rather than a hope: the bytes cross the IPC boundary and are held in a renderer as a
 * blob, and a project holds video. Thirty-two megabytes covers any still a studio compares and
 * refuses the take that would freeze the window it was meant to be shown in.
 */
export const BLOB_MAX_BYTES = 32 * 1024 * 1024

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
 * The bytes of the file as it stands on disk — the other half of a comparison, when what is
 * being compared is a change that has not been recorded yet.
 *
 * The size is asked BEFORE the read rather than after: reading a two-gigabyte take into memory
 * to then decide it is too big is the failure this ceiling exists to prevent.
 *
 * The path has already been validated as relative and unable to climb out — see `gitPath`. This
 * joins it to the project root and no other.
 */
export async function workingBlob(root: string, path: string): Promise<Uint8Array | null> {
  const file = join(root, path)

  try {
    if ((await stat(file)).size > BLOB_MAX_BYTES) return null
    return new Uint8Array(await readFile(file))
  } catch {
    return null
  }
}
