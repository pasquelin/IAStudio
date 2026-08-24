/**
 * Installs the door's tensor libraries with the interpreter the app already ships.
 *
 * `pip` and not `uv`: nothing but the embedded interpreter can be assumed on the computer, and it
 * carries pip. The declaration comes from the ENGINE (`engine.requirements`), never from a list
 * written here — one copied into TypeScript would drift from the one `uv` resolves.
 */

export type InstallEngineLibraries = {
  /** The embedded interpreter — `bundledEngine().python`. Never the computer's own. */
  readonly python: string
  /** What `pyproject.toml` declares for the door's extra, handed over verbatim. */
  readonly declaration: readonly string[]
  /** Every line the run writes, stdout and stderr alike: pip draws its bar on the second. */
  readonly spawn: (
    command: string,
    args: readonly string[],
    onLine: (line: string) => void,
    signal: AbortSignal,
  ) => Promise<void>
  readonly onProgress: (ratio: number) => void
  readonly signal: AbortSignal
}

const DOWNLOADED = /([\d.]+)\/([\d.]+)\s*(kB|MB|GB)/
const SIZES: Readonly<Record<string, number>> = { kB: 1e3, MB: 1e6, GB: 1e9 }
/** The last hundredth is the install itself, which pip draws no bar for. */
const RESOLVED = 0.99

/**
 * What pip's own bar says, turned into one ratio.
 *
 * **Blind spot, in clear**: the total is only what pip has ANNOUNCED so far, and it grows as the
 * resolver discovers wheels — so this is held monotonic by construction rather than by measure. A
 * bar that walked backwards on a 682 MB download would read as a failure.
 */
export function pipProgress(): (line: string) => number | null {
  let done = 0
  let total = 0
  let current = 0
  let highest = 0

  return line => {
    const found = DOWNLOADED.exec(line)
    if (!found) return null

    const unit = SIZES[found[3] ?? ''] ?? 1
    const at = Number(found[1]) * unit
    const size = Number(found[2]) * unit
    // A different size means pip restarted its bar on the next wheel, so the one before it landed.
    if (size !== current) {
      done += current
      total += size
      current = size
    }

    highest = Math.max(highest, total === 0 ? 0 : Math.min((done + at) / total, RESOLVED))
    return highest
  }
}

/** Everything the environment lacks, in ONE pip run: it resolves them together or not at all. */
export async function installEngineLibraries(deps: InstallEngineLibraries): Promise<void> {
  if (deps.declaration.length === 0) return

  const read = pipProgress()
  await deps.spawn(
    deps.python,
    ['-m', 'pip', 'install', '--upgrade', '--no-input', ...deps.declaration],
    line => {
      const ratio = read(line)
      if (ratio !== null) deps.onProgress(ratio)
    },
    deps.signal,
  )
}
