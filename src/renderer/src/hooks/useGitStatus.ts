import { useEffect } from 'react'
import type { GitRepository } from '@shared/domain/git'
import { getBridge } from '@/services/bridge'
import { useGit } from '@/stores/git'

/**
 * The repository, kept honest without polling anything.
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
 * Safe to mount from more than one panel — the store holds one answer, and the main process runs
 * one git at a time whatever asks.
 */
export function useGitStatus(): GitRepository {
  const repository = useGit(state => state.repository)
  const refresh = useGit(state => state.refresh)

  useEffect(() => {
    const ask = (): void => {
      void refresh()
    }

    ask()

    const bridge = getBridge()
    const offProject = bridge?.project.onChange(ask)
    const offFolder = bridge?.project.onFolderChanged(ask)
    window.addEventListener('focus', ask)

    return () => {
      offProject?.()
      offFolder?.()
      window.removeEventListener('focus', ask)
    }
  }, [refresh])

  return repository
}
