import { create } from 'zustand'
import type { GitBranch, GitRepository } from '@shared/domain/git'
import { getBridge } from '@/services/bridge'

type GitState = {
  repository: GitRepository
  /** Whether a command is in flight. What greys the buttons, so nothing is asked for twice. */
  busy: boolean
  /**
   * The commit message being written, held here rather than in the panel.
   *
   * A panel that is switched away from and back — one click on the rail — remounts, and a
   * message typed into component state would be gone. It survives a project change too, which
   * is wrong for exactly nobody: it is emptied when a commit lands.
   */
  message: string
  amend: boolean

  refresh: () => Promise<void>
  initRepository: () => Promise<void>
  stage: (paths: readonly string[]) => Promise<void>
  unstage: (paths: readonly string[]) => Promise<void>
  restore: (paths: readonly string[]) => Promise<void>
  commit: () => Promise<void>
  branches: () => Promise<GitBranch[]>
  createBranch: (name: string) => Promise<void>
  checkout: (name: string) => Promise<void>
  writeMessage: (message: string) => void
  setAmend: (amend: boolean) => void
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
export const useGit = create<GitState>()((set, get) => {
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
    message: '',
    amend: false,

    refresh: () => run(getBridge()?.git.read()),
    initRepository: () => run(getBridge()?.git.init()),
    stage: paths => run(getBridge()?.git.stage(paths)),
    unstage: paths => run(getBridge()?.git.unstage(paths)),
    restore: paths => run(getBridge()?.git.restore(paths)),

    commit: async () => {
      const { message, amend } = get()
      await run(getBridge()?.git.commit(message, amend))

      // Emptied only where the commit actually landed. A message cleared after a refusal — no
      // identity configured is the one everybody meets first — would lose what was typed at the
      // exact moment the user has to fix something and try again.
      if (get().repository.kind === 'ready') set({ message: '', amend: false })
    },

    branches: async () => (await getBridge()?.git.branches()) ?? [],
    createBranch: name => run(getBridge()?.git.createBranch(name)),
    checkout: name => run(getBridge()?.git.checkout(name)),

    writeMessage: message => set({ message }),
    setAmend: amend => set({ amend }),
  }
})
