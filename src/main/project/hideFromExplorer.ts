import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

/**
 * A leading dot hides on macOS and Linux and means nothing on Windows, which reads the
 * FILE_ATTRIBUTE_HIDDEN bit that Node does not expose. `attrib` is the only way to set it
 * without a native module, and it costs one short process per project rather than per file.
 *
 * Failures are swallowed on purpose: a manifest the Explorer happens to show is a cosmetic
 * problem, and refusing to open the project over it would be a real one.
 */
export async function hideFromExplorer(path: string): Promise<void> {
  if (process.platform !== 'win32') return

  try {
    await execFile('attrib', ['+h', path])
  } catch {
    return
  }
}
