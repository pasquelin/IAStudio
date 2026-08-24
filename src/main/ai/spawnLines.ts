import { spawn } from 'node:child_process'

/**
 * Runs a command and hands over its output ONE LINE AT A TIME, both streams merged.
 *
 * A progress bar is drawn with carriage returns and never a newline, so a reader that waits for
 * `\n` sees nothing until the download ends — which is the whole of what a person watches.
 */
export function spawnLines(
  command: string,
  args: readonly string[],
  onLine: (line: string) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { windowsHide: true })
    let pending = ''

    const read = (chunk: Buffer): void => {
      pending += chunk.toString('utf8')
      const parts = pending.split(/\r\n|\r|\n/)
      pending = parts.pop() ?? ''
      for (const line of parts) onLine(line)
    }

    child.stdout.on('data', read)
    child.stderr.on('data', read)

    const stop = (): void => {
      child.kill()
    }
    signal.addEventListener('abort', stop, { once: true })

    child.on('error', reject)
    child.on('close', code => {
      signal.removeEventListener('abort', stop)
      if (pending !== '') onLine(pending)
      // A cancel is not a failure, and the caller asked for it: it settles rather than throwing.
      if (signal.aborted || code === 0) resolve()
      else reject(new Error(`${command} exited with ${String(code)}`))
    })
  })
}
