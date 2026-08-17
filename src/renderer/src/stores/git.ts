import { create } from 'zustand'
import type { GitRepository } from '@shared/domain/git'
import { getBridge } from '@/services/bridge'

type GitState = {
  repository: GitRepository
  /** Whether a command is in flight. What greys the buttons, so nothing is asked for twice. */
  busy: boolean

  refresh: () => Promise<void>
  initRepository: () => Promise<void>
}

/**
 * The repository, as this window sees it.
 *
 * A store rather than a read per panel: the Git panel and the History panel look at the same
 * folder, and two copies of one answer is two panels disagreeing about which branch is out.
 *
 * Nothing is polled. What refreshes it is `useGitStatus`, off the events the studio already
 * publishes — the project changing, its folder changing on disk, the window coming back to the
 * front. A watcher of its own over a hundred thousand files is exactly what invariant 6 forbids,
 * and the studio has one already.
 */
export const useGit = create<GitState>()(set => {
  let running = 0

  const run = async (answer: Promise<GitRepository> | undefined): Promise<void> => {
    if (!answer) return

    running += 1
    set({ busy: true })
    try {
      set({ repository: await answer })
    } catch {
      // The main process answers a union for every git failure, so a rejection here means the
      // channel itself failed. What was on screen is the last thing known to be true about the
      // folder — better than a state invented from an error that says nothing about git.
    } finally {
      running -= 1
      // Only the LAST one lifts it: two panels refreshing together would otherwise have the
      // first to land clear the flag while the second is still running.
      if (running === 0) set({ busy: false })
    }
  }

  return {
    repository: { kind: 'no-project' },
    busy: false,

    refresh: () => run(getBridge()?.git.read()),
    initRepository: () => run(getBridge()?.git.init()),
  }
})
