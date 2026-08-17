import { simpleGit } from 'simple-git'

/**
 * Asking git which version it is. Injected rather than called, so the two answers the studio has
 * to draw — found and not found — are both reachable from a test on a machine that has git.
 */
export type VersionProbe = () => Promise<{ installed: boolean }>

/**
 * Whether this machine has git, and which one answered.
 *
 * The question is asked at all because the answer is routinely NO. simple-git spawns the `git`
 * binary rather than speaking the protocol itself: macOS answers by offering to install the
 * command line tools, and a plain Windows install has no git whatsoever. A panel that discovered
 * this at the first commit would have let the user arrange a commit that cannot happen.
 *
 * Anything thrown is the same answer as `installed: false` — a binary that will not start is a
 * binary this machine does not have, whichever way it declines.
 */
export async function detectGit(probe: VersionProbe): Promise<boolean> {
  try {
    return (await probe()).installed
  } catch {
    return false
  }
}

/**
 * The real probe, optionally against a binary the user named.
 *
 * `simpleGit` VALIDATES a custom binary as it is built, and throws for anything holding a
 * character outside its own list — a space, most of all, which is exactly what the default
 * Windows install path has. Building it here rather than at the call site is what turns that
 * throw into the ordinary "no git" answer instead of an unhandled rejection at startup.
 */
export function gitVersionProbe(binary?: string): VersionProbe {
  return async () => {
    const git = binary ? simpleGit({ binary }) : simpleGit()
    return await git.version()
  }
}
