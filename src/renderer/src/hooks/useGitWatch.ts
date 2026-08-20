import { useEffect } from 'react'
import { getBridge } from '@/services/bridge'
import { useGit } from '@/stores/git'

/**
 * Keeps the repository honest without polling anything, and WITHOUT subscribing to the answer.
 *
 * Three signals, and the studio already publishes all three. A project opened or closed changes
 * which folder is being versioned; the folder watch already running over the project says when a
 * file moved, including a file moved by something that is not the studio; and the window coming
 * back to the front is when the user has just been editing elsewhere — it is what every version
 * panel worth using refreshes on, and it costs one `git status`.
 *
 * A watcher of its own would be the obvious alternative and the wrong one: a hundred thousand
 * files under `chokidar` is precisely the work invariant 6 keeps off this process, and it would
 * be the second watch over the same folder.
 *
 * Apart from `useGitStatus` so the SHELL can mount it: subscribing the root to `repository` would
 * re-render the whole window every time a file the studio itself wrote changed the status.
 *
 * Safe to mount more than once — the store holds one answer, and a read that is already out is
 * shared rather than started again, so three mounts woken by one event still run one git.
 */
export function useGitWatch(): void {
  const refresh = useGit(state => state.refresh)
  const readRemotes = useGit(state => state.readRemotes)

  useEffect(() => {
    const ask = (): void => {
      void refresh()
    }

    // The server is read on the project alone. A remote is added by hand, from this panel or from
    // a terminal, where a file changes several times a minute — and a project opened IS a
    // different repository, which may well talk to a different server. Reading it on all three
    // was one git process per file written, for an answer that had not changed since the project
    // was opened.
    const askAll = (): void => {
      ask()
      void readRemotes()
    }

    askAll()

    const bridge = getBridge()
    const offProject = bridge?.project.onChange(askAll)
    const offFolder = bridge?.project.onFolderChanged(ask)
    window.addEventListener('focus', ask)

    return () => {
      offProject?.()
      offFolder?.()
      window.removeEventListener('focus', ask)
    }
  }, [refresh, readRemotes])
}
